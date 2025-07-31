// ~/projects/new-blog/apps/backend/src/index.ts

// ---------------------------
// 1. 필요한 라이브러리 임포트
// ---------------------------
// AWS SDK v3 클라이언트
import { DynamoDBClient, ReturnValue } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand, // GSI 쿼리를 위해 QueryCommand 추가
} from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { v4 as uuidv4 } from 'uuid'; // 고유 ID 생성을 위해
import { Hono, Context } from 'hono'; // Hono 프레임워크 및 Context 타입 임포트
import { handle, LambdaEvent, LambdaContext } from 'hono/aws-lambda'; // LambdaEvent, LambdaContext 임포트
import { z, ZodError, ZodIssue } from 'zod'; // Zod 라이브러리 및 ZodError, ZodIssue 타입 임포트
import { zValidator } from '@hono/zod-validator'; // 올바른 패키지: @hono/zod-validator 임포트

// ⭐ 수정됨: AWS Lambda 이벤트 타입 임포트 및 확장 정의 ⭐
import type {
  APIGatewayProxyEventV2,
  APIGatewayEventRequestContextV2,
  Context as AwsLambdaContext, // aws-lambda의 Context와 Hono의 Context 이름 충돌 방지
} from 'aws-lambda';

// Authorizer에 JWT claims가 붙은 requestContext 타입 정의
interface APIGatewayEventRequestContextV2WithAuth extends APIGatewayEventRequestContextV2 {
  authorizer: {
    jwt: {
      claims: {
        sub: string;
        email: string;
        [key: string]: any; // 그 외의 클레임들을 포함
      };
      scopes?: string[];
    };
  };
}

// 전체 이벤트 타입에 반영 (requestContext를 확장된 타입으로 오버라이드)
type APIGatewayProxyEventV2WithAuth = Omit<
  APIGatewayProxyEventV2,
  'requestContext'
> & {
  requestContext: APIGatewayEventRequestContextV2WithAuth;
};


// ---------------------------
// 2. AWS 클라이언트 초기화
// ---------------------------
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient); // DynamoDB Document Client (더 쉬운 데이터 조작)

const cognitoClient = new CognitoIdentityProviderClient({}); // Cognito Identity Provider Client

// ---------------------------
// 3. 환경 변수 로드
// ---------------------------
// Lambda 함수가 배포될 때 CDK에 의해 자동으로 주입될 환경 변수들
const TABLE_NAME = process.env.TABLE_NAME || 'default-table-name'; // 기본값 설정 (로컬 테스트용)
const USER_POOL_ID = process.env.USER_POOL_ID || 'default-user-pool-id';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || 'default-user-pool-client-id';

// ---------------------------
// 4. Hono 앱 컨텍스트 타입 정의
// ---------------------------
// Hono 컨텍스트에 저장될 사용자 정의 변수들의 타입을 정의합니다.
type AppVariables = {
  userId?: string;
  userEmail?: string;
};

// Hono의 Bindings 타입을 정의하여 Lambda 이벤트 객체에 접근할 수 있도록 합니다.
// 'hono/aws-lambda'의 LambdaEvent와 LambdaContext를 사용합니다.
type Bindings = {
  event: APIGatewayProxyEventV2WithAuth; // ⭐ 수정됨: APIGatewayProxyEventV2WithAuth 타입 사용 ⭐
  lambdaContext: AwsLambdaContext; // ⭐ 수정됨: aws-lambda의 Context 타입 사용 ⭐
};

// ⭐ 수정됨: AppValidationTargets 정의 제거 ⭐
// zValidator가 자동으로 타입을 추론하므로, 명시적인 ValidationTargets 정의는 필요하지 않습니다.

// ---------------------------
// 5. Zod 스키마 정의 (데이터 유효성 검사 규칙)
// ---------------------------
// 사용자 인증 스키마
const SignUpSchema = z.object({
  email: z.string().email('유효한 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

const LoginSchema = z.object({
  email: z.string().email('유효한 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

// 게시물 스키마
const CreatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.'),
  content: z.string().min(1, '내용은 필수 항목입니다.'),
  // tags: z.array(z.string()).max(10, '태그는 최대 10개까지 가능합니다.').optional(), // 향후 태그 기능 추가 시 사용
});

const UpdatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.').optional(),
  content: z.string().min(1, '내용은 필수 항목입니다.').optional(),
  // tags: z.array(z.string()).max(10, '태그는 최대 10개까지 가능합니다.').optional(), // 향후 태그 기능 추가 시 사용
}).refine(data => data.title !== undefined || data.content !== undefined, {
  message: '제목 또는 내용은 최소 하나 이상 제공되어야 합니다.',
});


// ---------------------------
// 6. Hono 앱 초기화
// ---------------------------
// Hono 앱을 초기화할 때, Bindings, Variables 타입만 전달합니다.
// ⭐ 수정됨: ValidationTargets 제네릭 제거 ⭐
const app = new Hono<{ Bindings: Bindings, Variables: AppVariables }>();

// ---------------------------
// 7. 커스텀 미들웨어 정의
// ---------------------------

// 인증 미들웨어: API Gateway Authorizer로부터 사용자 정보 추출
// 모든 요청에 대해 실행되어 Lambda 이벤트에서 사용자 정보를 파싱합니다.
app.use('*', async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>, next: () => Promise<void>) => { // ⭐ 수정됨: Context 타입에서 ValidationTargets 제거 ⭐
  const requestContext = c.env.event.requestContext; // c.env.event를 사용하여 원본 Lambda 이벤트에 접근
  // ⭐ 수정됨: APIGatewayProxyEventV2WithAuth의 authorizer 구조에 맞게 접근 ⭐
  const userId = requestContext?.authorizer?.jwt?.claims?.sub;
  const userEmail = requestContext?.authorizer?.jwt?.claims?.email;

  // Hono 컨텍스트에 사용자 정보 저장 (라우트 핸들러에서 쉽게 접근 가능)
  c.set('userId', userId);
  c.set('userEmail', userEmail);

  await next(); // 다음 미들웨어 또는 라우트 핸들러로 진행
});

// 인증 필요 미들웨어: 특정 API에 대한 접근 제어
// 이 미들웨어가 적용된 라우트는 userId가 없으면 401 Unauthorized 응답을 반환합니다.
const authRequired = async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>, next: () => Promise<void>) => { // ⭐ 수정됨: Context 타입에서 ValidationTargets 제거 ⭐
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ message: 'Unauthorized: Authentication required.' }, 401);
  }
  await next();
};

// ---------------------------
// 8. API 라우트 정의 (Hono)
// ---------------------------

// 헬로 월드 엔드포인트
app.get('/hello', async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>) => { // ⭐ 수정됨: Context 타입에서 ValidationTargets 제거 ⭐
  return c.json({
    message: 'Hello from your backend Lambda!',
    input: c.env.event, // 원본 Lambda 이벤트를 c.env.event로 접근
    tableName: TABLE_NAME,
  });
});

// --- 사용자 인증 관련 API ---

// 회원가입 (Sign Up)
// ZodValidator 미들웨어가 요청 바디의 유효성을 자동으로 검사합니다.
app.post('/auth/signup', zValidator('json', SignUpSchema), async (c) => { // ⭐ 수정됨: zValidator 사용법은 동일하며, Context 타입은 Hono가 자동으로 추론 ⭐
  const { email, password } = c.req.valid('json');

  try {
    const signUpParams = {
      ClientId: USER_POOL_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    };
    await cognitoClient.send(new SignUpCommand(signUpParams));
    return c.json({ message: 'User signed up successfully. Please confirm your email.' }, 200);
  } catch (error: any) {
    console.error('Sign Up Error:', error);
    if (error.name === 'UsernameExistsException') {
      return c.json({ message: 'User with this email already exists.' }, 409); // Conflict
    } else if (error.name === 'InvalidPasswordException' || error.name === 'InvalidParameterException') {
      return c.json({ message: error.message }, 400); // Bad Request
    }
    return c.json({ message: 'Internal Server Error during sign up.', error: error.message }, 500);
  }
});

// 로그인 (Login)
app.post('/auth/login', zValidator('json', LoginSchema), async (c) => { // ⭐ 수정됨: zValidator 사용법은 동일하며, Context 타입은 Hono가 자동으로 추론 ⭐
  const { email, password } = c.req.valid('json');

  try {
    const authParams = {
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };
    const authResponse = await cognitoClient.send(new InitiateAuthCommand(authParams));
    return c.json({
      message: 'Authentication successful',
      authenticationResult: authResponse.AuthenticationResult,
    }, 200);
  } catch (error: any) {
    console.error('Login Error:', error);
    if (error.name === 'UserNotFoundException' || error.name === 'NotAuthorizedException') {
      return c.json({ message: 'Invalid credentials.' }, 401); // Unauthorized
    }
    return c.json({ message: 'Internal Server Error during login.', error: error.message }, 500);
  }
});

// 로그아웃 (Global Sign Out)
app.post('/auth/logout', authRequired, async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>) => { // ⭐ 수정됨: Context 타입에서 ValidationTargets 제거 ⭐
  const accessToken = c.req.header('Authorization')?.split(' ')[1];

  if (!accessToken) {
    return c.json({ message: 'Access Token required for logout.' }, 400);
  }

  try {
    await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
    return c.json({ message: 'User logged out successfully.' }, 200);
  } catch (error: any) {
    console.error('Logout Error:', error);
    return c.json({ message: 'Logout process initiated. Please clear tokens on client side.' }, 200);
  }
});

// --- 게시물 CRUD API ---

// 게시물 생성 (Create Post)
app.post('/posts', authRequired, zValidator('json', CreatePostSchema), async (c) => { // ⭐ 수정됨: zValidator 사용법은 동일하며, Context 타입은 Hono가 자동으로 추론 ⭐
  const { title, content } = c.req.valid('json');
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');

  const postId = uuidv4();
  const now = new Date().toISOString();

  const item = {
    PK: `POST#${postId}`,
    SK: 'METADATA',
    data_type: 'Post',
    postId: postId,
    title: title,
    content: content,
    authorId: userId,
    authorEmail: userEmail,
    createdAt: now,
    updatedAt: now,
    isDeleted: false, // ⭐ 소프트 삭제 플래그 기본값 ⭐
    viewCount: 0, // ⭐ 조회수 기본값 ⭐
    // tags: tags || [], // 향후 태그 기능 추가 시 사용
    // GSI1 for USER_POSTS_BY_DATE
    GSI1_PK: `USER#${userId}`,
    GSI1_SK: `POST#${now}#${postId}`, // createdAt을 포함하여 최신순 정렬 가능
    // GSI3 for ALL_POSTS_BY_DATE
    GSI3_PK: `POST#ALL`,
    GSI3_SK: `${now}#${postId}`, // createdAt을 포함하여 전체 최신순 정렬 가능
  };

  try {
    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }));
    return c.json({ message: 'Post created successfully!', post: item }, 201);
  } catch (error: any) {
    console.error('Create Post Error:', error);
    return c.json({ message: 'Internal Server Error creating post.', error: error.message }, 500);
  }
});

// 모든 게시물 조회 (Get All Posts - GSI3 활용)
app.get('/posts', async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>) => { // ⭐ 수정됨: Context 타입에서 ValidationTargets 제거 ⭐
  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3', // ⭐ GSI3 사용 ⭐
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'POST#ALL',
      },
      ScanIndexForward: false, // ⭐ 최신순 정렬 (SK가 내림차순으로 정렬되도록) ⭐
    };

    const { Items } = await ddbDocClient.send(new QueryCommand(params));
    // Soft Delete된 게시물 필터링
    const activePosts = Items?.filter(item => item.data_type === 'Post' && !item.isDeleted) || [];

    return c.json({ posts: activePosts }, 200);
  } catch (error: any) {
    console.error('Get All Posts Error:', error);
    return c.json({ message: 'Internal Server Error fetching posts.', error: error.message }, 500);
  }
});

// 특정 게시물 조회 (Get One Post)
app.get('/posts/:postId', async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>) => { // ⭐ 수정됨: Context 타입에서 ValidationTargets 제거 ⭐
  const postId = c.req.param('postId');

  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `POST#${postId}`,
        SK: 'METADATA',
      },
    };
    const { Item } = await ddbDocClient.send(new GetCommand(params));

    if (!Item || Item.isDeleted) { // ⭐ 소프트 삭제된 게시물도 조회되지 않도록 ⭐
      return c.json({ message: 'Post not found.' }, 404);
    }

    return c.json({ post: Item }, 200);
  } catch (error: any) {
    console.error('Get Post Error:', error);
    return c.json({ message: 'Internal Server Error fetching post.', error: error.message }, 500);
  }
});

// 게시물 업데이트 (Update Post)
app.put('/posts/:postId', authRequired, zValidator('json', UpdatePostSchema), async (c) => { // ⭐ 수정됨: zValidator 사용법은 동일하며, Context 타입은 Hono가 자동으로 추론 ⭐
  const postId = c.req.param('postId');
  const { title, content } = c.req.valid('json');
  const userId = c.get('userId');
  const now = new Date().toISOString();

  try {
    // 1. 게시물 존재 여부 및 작성자 확인
    const getParams = {
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    };
    const { Item: existingPost } = await ddbDocClient.send(new GetCommand(getParams));

    if (!existingPost || existingPost.isDeleted) { // ⭐ 소프트 삭제된 게시물은 업데이트 불가 ⭐
      return c.json({ message: 'Post not found for update.' }, 404);
    }
    if (existingPost.authorId !== userId) {
      return c.json({ message: 'Forbidden: You are not the author of this post.' }, 403);
    }

    // 2. 업데이트 표현식 구성
    let UpdateExpression = 'set updatedAt = :updatedAt';
    const ExpressionAttributeValues: { [key: string]: any } = {
      ':updatedAt': now,
    };

    if (title) {
      UpdateExpression += ', title = :title';
      ExpressionAttributeValues[':title'] = title;
    }
    if (content) {
      UpdateExpression += ', content = :content';
      ExpressionAttributeValues[':content'] = content;
    }

    const updateParams = {
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      UpdateExpression: UpdateExpression,
      ExpressionAttributeValues: ExpressionAttributeValues,
      ReturnValues: ReturnValue.ALL_NEW, // 업데이트된 모든 속성 반환
    };

    const { Attributes } = await ddbDocClient.send(new UpdateCommand(updateParams));

    return c.json({ message: 'Post updated successfully!', post: Attributes }, 200);
  } catch (error: any) {
    console.error('Update Post Error:', error);
    return c.json({ message: 'Internal Server Error updating post.', error: error.message }, 500);
  }
});

// 게시물 삭제 (Delete Post - 소프트 삭제)
app.delete('/posts/:postId', authRequired, async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>) => { // ⭐ 수정됨: Context 타입에서 ValidationTargets 제거 ⭐
  const postId = c.req.param('postId');
  const userId = c.get('userId');
  const now = new Date().toISOString();

  try {
    // 1. 게시물 존재 여부 및 작성자 확인
    const getParams = {
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    };
    const { Item: existingPost } = await ddbDocClient.send(new GetCommand(getParams));

    if (!existingPost || existingPost.isDeleted) { // ⭐ 이미 소프트 삭제되었거나 없는 게시물 ⭐
      return c.json({ message: 'Post not found for deletion.' }, 404);
    }
    if (existingPost.authorId !== userId) {
      return c.json({ message: 'Forbidden: You are not the author of this post.' }, 403);
    }

    // 2. isDeleted 플래그를 true로 업데이트 (소프트 삭제)
    const updateParams = {
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      UpdateExpression: 'set isDeleted = :isDeleted, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isDeleted': true,
        ':updatedAt': now,
      },
      ReturnValues: ReturnValue.ALL_NEW,
    };

    await ddbDocClient.send(new UpdateCommand(updateParams));

    return c.json({ message: 'Post soft-deleted successfully!' }, 200);
  } catch (error: any) {
    console.error('Delete Post Error:', error);
    return c.json({ message: 'Internal Server Error deleting post.', error: error.message }, 500);
  }
});

// ---------------------------
// 9. Hono 에러 핸들링
// ---------------------------
app.onError((err, c) => {
  console.error(`Hono Error: ${err}`); // 로그 메시지 명확화
  // Zod 유효성 검사 에러 처리
  if (err instanceof ZodError) {
    // Zod 에러 메시지를 더 친화적으로 포맷
    const errors = err.issues.map((e: ZodIssue) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return c.json({ message: 'Validation Error', errors: errors }, 400);
  }
  // Cognito 관련 에러 처리 (ZodError가 아닌 경우)
  if (err.name === 'UserNotFoundException' || err.name === 'NotAuthorizedException' || err.name === 'UsernameExistsException' || err.name === 'CodeMismatchException' || err.name === 'ExpiredCodeException' || err.name === 'LimitExceededException') {
    return c.json({ message: err.message }, 400); // Bad Request for Cognito specific errors
  }
  // 기타 서버 에러
  return c.json({ message: 'Internal Server Error', error: err.message }, 500);
});

// ---------------------------
// 10. Lambda 핸들러로 Hono 앱 내보내기
// ---------------------------
// `handle` 함수가 Hono 앱을 AWS Lambda 이벤트에 맞게 변환해줍니다.
export const handler = handle(app);
