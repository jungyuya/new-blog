// 경로: ~/projects/new-blog/apps/backend/src/index.ts 

import { DynamoDBClient, ReturnValue } from '@aws-sdk/client-dynamodb';
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient, 
  SignUpCommand, 
  InitiateAuthCommand, 
  AdminInitiateAuthCommand, 
  RespondToAuthChallengeCommand,
  GlobalSignOutCommand, 
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { v4 as uuidv4 } from 'uuid';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = new (require('@aws-sdk/lib-dynamodb')).DynamoDBDocumentClient(ddbClient);

const cognitoClient = new CognitoIdentityProviderClient({}); 

export const handler = async (event: any) => {
  console.log('Lambda function invoked with event:', event);

  const tableName = process.env.TABLE_NAME;
  const userPoolId = process.env.USER_POOL_ID; 
  const userPoolClientId = process.env.USER_POOL_CLIENT_ID; 

  if (!tableName || !userPoolId || !userPoolClientId) { // <-- 조건문 수정!
    console.error('Environment variables are not set!');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal Server Error: Environment variables not configured.' }),
    };
  }

  const { httpMethod, path, body, requestContext } = event; // requestContext 추가!

  // 사용자 인증 정보 추출 (API Gateway Cognito Authorizer 사용 시 )
  // requestContext.authorizer.claims에 인증된 사용자 정보가 포함됩니다.
  const userId = requestContext?.authorizer?.claims?.sub; // User Pool에서 고유한 사용자 ID (sub)
  const userEmail = requestContext?.authorizer?.claims?.email; // User Pool에서 사용자 이메일

  try {
    // 기존 Hello World 경로 유지.
    if (path === '/hello' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello from your backend Lambda!',
          input: event,
          tableName: tableName,
        }),
      };
    }

    // --- 사용자 인증 관련 API 시작 ---
    else if (path === '/auth/signup' && httpMethod === 'POST') {
      // 회원가입 (Sign Up)
      const { email, password } = JSON.parse(body);
      const signUpParams = {
        ClientId: userPoolClientId,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      };
      await cognitoClient.send(new SignUpCommand(signUpParams));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'User signed up successfully. Please confirm your email.' }),
      };
    } else if (path === '/auth/login' && httpMethod === 'POST') {
      // 로그인 (Authenticate)
      const { email, password } = JSON.parse(body);
      const authParams = {
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: userPoolClientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      };
      const authResponse = await cognitoClient.send(new InitiateAuthCommand(authParams));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Authentication successful',
          authenticationResult: authResponse.AuthenticationResult,
        }),
      };
    } else if (path === '/auth/logout' && httpMethod === 'POST') {
      // 로그아웃 (GlobalSignOut)
      // 이 API는 클라이언트에서 발급받은 Access Token을 Authorization 헤더에 포함시켜 호출해야 함.
      const accessToken = event.headers?.Authorization?.split(' ')[1]; // Bearer <token>
      if (!accessToken) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Access Token required for logout.' }),
        };
      }
      await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'User logged out successfully.' }),
      };
    }
    // --- 사용자 인증 관련 API 끝 ---

    // --- 인증이 필요한 API (게시물 CRUD) 시작 ---
    // 인증되지 않은 사용자 (userId가 없음)는 게시물 생성/수정/삭제 불가
    if (['POST', 'PUT', 'DELETE'].includes(httpMethod) && !userId) {
      return {
        statusCode: 401, // Unauthorized
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Unauthorized: Authentication required.' }),
      };
    }

    if (path === '/posts' && httpMethod === 'POST') {
      // 게시물 생성 (Create) - 이제 userId와 userEmail 추가!
      const requestBody = JSON.parse(body);
      const postId = uuidv4();
      const { title, content } = requestBody;

      if (!title || !content) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Title and content are required.' }),
        };
      }

      const params = {
        TableName: tableName,
        Item: {
          postId: postId,
          title: title,
          content: content,
          authorId: userId, // <-- 이 줄 추가!
          authorEmail: userEmail, // <-- 이 줄 추가!
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      await ddbDocClient.send(new PutCommand(params));

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Post created successfully!', post: params.Item }),
      };
    } else if (path === '/posts' && httpMethod === 'GET') {
      // 모든 게시물 조회 (Read - All)
      // 이 API는 인증 여부와 관계없이 모두 접근 가능
      const params = {
        TableName: tableName,
      };
      const { Items } = await ddbDocClient.send(new ScanCommand(params));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: Items }),
      };
    } else if (path.startsWith('/posts/') && httpMethod === 'GET') {
      // 특정 게시물 조회 (Read - One)
      // 이 API는 인증 여부와 관계없이 모두 접근 가능
      const postId = path.split('/').pop();

      const params = {
        TableName: tableName,
        Key: { postId: postId },
      };
      const { Item } = await ddbDocClient.send(new GetCommand(params));

      if (!Item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Post not found.' }),
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: Item }),
      };
    } else if (path.startsWith('/posts/') && httpMethod === 'PUT') {
      // 게시물 업데이트 (Update)
      const postId = path.split('/').pop();
      const requestBody = JSON.parse(body);
      const { title, content } = requestBody;

      // 게시물의 소유자만 업데이트 가능하도록 인가 로직 추가
      const getParams = { TableName: tableName, Key: { postId: postId } };
      const { Item: existingPost } = await ddbDocClient.send(new GetCommand(getParams));

      if (!existingPost) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Post not found for update.' }),
        };
      }
      if (existingPost.authorId !== userId) { // <-- 인가 로직: 소유자 확인!
        return {
          statusCode: 403, // Forbidden
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Forbidden: You are not the author of this post.' }),
        };
      }

      let UpdateExpression = 'set updatedAt = :updatedAt';
      const ExpressionAttributeValues: { [key: string]: any } = {
        ':updatedAt': new Date().toISOString(),
      };

      if (title) {
        UpdateExpression += ', title = :title';
        ExpressionAttributeValues[':title'] = title;
      }
      if (content) {
        UpdateExpression += ', content = :content';
        ExpressionAttributeValues[':content'] = content;
      }

      const params = {
        TableName: tableName,
        Key: { postId: postId },
        UpdateExpression: UpdateExpression,
        ExpressionAttributeValues: ExpressionAttributeValues,
        ReturnValues: ReturnValue.ALL_NEW,
      };

      const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Post updated successfully!', post: Attributes }),
      };
    } else if (path.startsWith('/posts/') && httpMethod === 'DELETE') {
      // 게시물 삭제 (Delete)
      const postId = path.split('/').pop();

      // 게시물의 소유자만 삭제 가능하도록 인가 로직 추가
      const getParams = { TableName: tableName, Key: { postId: postId } };
      const { Item: existingPost } = await ddbDocClient.send(new GetCommand(getParams));

      if (!existingPost) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Post not found for deletion.' }),
        };
      }
      if (existingPost.authorId !== userId) { // <-- 인가 로직: 소유자 확인!
        return {
          statusCode: 403, // Forbidden
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Forbidden: You are not the author of this post.' }),
        };
      }

      const params = {
        TableName: tableName,
        Key: { postId: postId },
      };
      await ddbDocClient.send(new DeleteCommand(params));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Post deleted successfully!' }),
      };
    }

    // 일치하는 경로가 없을 경우
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Not Found' }),
    };
  } catch (error: any) {
    console.error('Error processing request:', error);
    // Cognito 에러 처리 추가
    if (error.name === 'UserNotFoundException' || error.name === 'NotAuthorizedException') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: error.message }),
      };
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};