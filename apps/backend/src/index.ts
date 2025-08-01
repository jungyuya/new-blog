// ~/projects/new-blog/apps/backend/src/index.ts
// ⭐⭐ 환경 변수 전체를 출력하여 디버깅합니다. ⭐⭐
console.info("⚙️ All Environment Variables:", JSON.stringify(process.env, null, 2));
// ---------------------------
// 1. 필요한 라이브러리 임포트
// ---------------------------
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
import { CognitoJwtVerifier } from 'aws-jwt-verify'; // AWS JWT Verify 라이브러리

// ---------------------------
// 2. 환경 변수 로드
// ---------------------------
const TABLE_NAME = process.env.TABLE_NAME || 'default-table-name';
const USER_POOL_ID = process.env.USER_POOL_ID || 'default-user-pool-id';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || 'default-user-pool-client-id';
const REGION = process.env.REGION || 'ap-northeast-2';
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://host.docker.internal:8000'; // ⭐️ 이 부분을 수정했습니다
// 환경 변수 로드 확인 로그
console.log('⚙️ TABLE_NAME=', TABLE_NAME);
console.log('⚙️ DYNAMODB_ENDPOINT=', DYNAMODB_ENDPOINT);

// ---------------------------
// 3. AWS 클라이언트 초기화
// ---------------------------
const ddbClient = new DynamoDBClient({
  region: REGION,
  ...(DYNAMODB_ENDPOINT && { endpoint: DYNAMODB_ENDPOINT }),
});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient); // DynamoDB Document Client

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'access',
  clientId: USER_POOL_CLIENT_ID,
});

// ---------------------------
// 4. Hono 앱 컨텍스트 타입 정의
// ---------------------------
type AppVariables = {
  userId?: string;
  userEmail?: string;
};

type Bindings = {
  jwtPayload: {
    sub: string;
    email: string;
  };
  event: LambdaEvent;
};

// ---------------------------
// 5. Zod 스키마 정의
// ---------------------------
const SignUpSchema = z.object({
  email: z.string().email('유효한 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

const LoginSchema = z.object({
  email: z.string().email('유효한 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

const CreatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.'),
  content: z.string().min(1, '내용은 필수 항목입니다.'),
});

const UpdatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.').optional(),
  content: z.string().min(1, '내용은 필수 항목입니다.').optional(),
}).refine(data => data.title !== undefined || data.content !== undefined, {
  message: '제목 또는 내용은 최소 하나 이상 제공되어야 합니다.',
});

// ---------------------------
// 6. Hono 앱 초기화
// ---------------------------
const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// ---------------------------
// 7. 커스텀 미들웨어: JWT 인증
// ---------------------------
const localAuthMiddleware = async (
  c: Context<{ Bindings: Bindings; Variables: AppVariables }>,
  next: () => Promise<void>
) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ message: 'Unauthorized: Authentication required.' }, 401);
    }
    const token = authHeader.split(' ')[1];

    const payload = await verifier.verify(token);
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email as string);

    await next();
  } catch (error: any) {
    console.error('JWT Verification Error:', error);
    return c.json({ message: 'Unauthorized: Invalid token.' }, 401);
  }
};

// ---------------------------
// 8. API 라우트 정의
// ---------------------------
app.get('/hello', async c => {
  return c.json({ message: 'Hello from your backend Lambda!', tableName: TABLE_NAME }, 200);
});

app.post('/auth/signup', zValidator('json', SignUpSchema), async c => {
  const { email, password } = c.req.valid('json');
  try {
    await cognitoClient.send(
      new SignUpCommand({ ClientId: USER_POOL_CLIENT_ID, Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] })
    );
    return c.json({ message: 'User signed up successfully. Please confirm your email.' }, 200);
  } catch (error: any) {
    console.error('Sign Up Error:', error);
    if (error.name === 'UsernameExistsException') return c.json({ message: 'User already exists.' }, 409);
    if (error.name === 'InvalidPasswordException' || error.name === 'InvalidParameterException') return c.json({ message: error.message }, 400);
    return c.json({ message: 'Internal Server Error during sign up.', error: error.message }, 500);
  }
});

app.post('/auth/login', zValidator('json', LoginSchema), async c => {
  const { email, password } = c.req.valid('json');
  try {
    const resp = await cognitoClient.send(
      new InitiateAuthCommand({ AuthFlow: AuthFlowType.USER_PASSWORD_AUTH, ClientId: USER_POOL_CLIENT_ID, AuthParameters: { USERNAME: email, PASSWORD: password } })
    );
    return c.json({ message: 'Authentication successful', authenticationResult: resp.AuthenticationResult }, 200);
  } catch (error: any) {
    console.error('Login Error:', error);
    if (error.name === 'UserNotFoundException' || error.name === 'NotAuthorizedException') return c.json({ message: 'Invalid credentials.' }, 401);
    return c.json({ message: 'Internal Server Error during login.', error: error.message }, 500);
  }
});

app.post('/auth/logout', localAuthMiddleware, async c => {
  const token = c.req.header('Authorization')?.split(' ')[1];
  if (!token) return c.json({ message: 'Access Token required for logout.' }, 400);
  try {
    await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: token }));
    return c.json({ message: 'User logged out successfully.' }, 200);
  } catch {
    return c.json({ message: 'Logout process initiated.' }, 200);
  }
});

app.post('/posts', localAuthMiddleware, zValidator('json', CreatePostSchema), async c => {
  const { title, content } = c.req.valid('json');
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const postId = uuidv4();
  const now = new Date().toISOString();
  const item = {
    PK: `POST#${postId}`, SK: 'METADATA', data_type: 'Post', postId, title, content,
    authorId: userId, authorEmail: userEmail, createdAt: now, updatedAt: now,
    isDeleted: false, viewCount: 0,
    GSI1_PK: `USER#${userId}`, GSI1_SK: `POST#${now}#${postId}`,
    GSI3_PK: 'POST#ALL', GSI3_SK: `${now}#${postId}`,
  };
  try {
    await ddbDocClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return c.json({ message: 'Post created successfully!', post: item }, 201);
  } catch (error: any) {
    console.error('Create Post Error:', error.stack || error);
    return c.json({ message: 'Internal Server Error creating post.', error: error.message }, 500);
  }
});

app.get('/posts', async c => {
  try {
    const { Items } = await ddbDocClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: { ':pk': 'POST#ALL' },
      ScanIndexForward: false,
    }));
    const activePosts = Items?.filter(i => i.data_type === 'Post' && !i.isDeleted) || [];
    return c.json({ posts: activePosts }, 200);
  } catch (error: any) {
    console.error('Get All Posts Error:', error);
    return c.json({ message: 'Internal Server Error fetching posts.', error: error.message }, 500);
  }
});

app.get('/posts/:postId', async c => {
  const postId = c.req.param('postId');
  try {
    const { Item } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    }));
    if (!Item || Item.isDeleted) return c.json({ message: 'Post not found.' }, 404);
    return c.json({ post: Item }, 200);
  } catch (error: any) {
    console.error('Get Post Error:', error);
    return c.json({ message: 'Internal Server Error fetching post.', error: error.message }, 500);
  }
});

app.put('/posts/:postId', localAuthMiddleware, zValidator('json', UpdatePostSchema), async c => {
  const postId = c.req.param('postId');
  const { title, content } = c.req.valid('json');
  const userId = c.get('userId');
  const now = new Date().toISOString();
  try {
    const { Item: existing } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    }));
    if (!existing || existing.isDeleted) return c.json({ message: 'Post not found for update.' }, 404);
    if (existing.authorId !== userId) return c.json({ message: 'Forbidden: You are not the author.' }, 403);
    let UpdateExpression = 'set updatedAt = :u';
    const vals: any = { ':u': now };
    if (title) { UpdateExpression += ', title = :t'; vals[':t'] = title; }
    if (content) { UpdateExpression += ', content = :c'; vals[':c'] = content; }
    const { Attributes } = await ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      UpdateExpression,
      ExpressionAttributeValues: vals,
      ReturnValues: ReturnValue.ALL_NEW,
    }));
    return c.json({ message: 'Post updated successfully!', post: Attributes }, 200);
  } catch (error: any) {
    console.error('Update Post Error:', error);
    return c.json({ message: 'Internal Server Error updating post.', error: error.message }, 500);
  }
});

app.delete('/posts/:postId', localAuthMiddleware, async c => {
  const postId = c.req.param('postId');
  const userId = c.get('userId');
  const now = new Date().toISOString();
  try {
    const { Item: existing } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    }));
    if (!existing || existing.isDeleted) return c.json({ message: 'Post not found for deletion.' }, 404);
    if (existing.authorId !== userId) return c.json({ message: 'Forbidden: You are not the author.' }, 403);
    await ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      UpdateExpression: 'set isDeleted = :d, updatedAt = :u',
      ExpressionAttributeValues: { ':d': true, ':u': now },
      ReturnValues: ReturnValue.ALL_NEW,
    }));
    return c.json({ message: 'Post soft-deleted successfully!' }, 200);
  } catch (error: any) {
    console.error('Delete Post Error:', error);
    return c.json({ message: 'Internal Server Error deleting post.', error: error.message }, 500);
  }
});

// ---------------------------
// 9. 에러 핸들링
// ---------------------------
app.onError((err, c) => {
  console.error(`Hono Error: ${err}`);
  if (err instanceof ZodError) {
    const errors = err.issues.map((e: ZodIssue) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return c.json({ message: 'Validation Error', errors }, 400);
  }
  if ([
    'UserNotFoundException', 'NotAuthorizedException', 'UsernameExistsException',
    'CodeMismatchException', 'ExpiredCodeException', 'LimitExceededException'
  ].includes(err.name)) {
    return c.json({ message: err.message }, 400);
  }
  return c.json({ message: 'Internal Server Error', error: err.message }, 500);
});

// ---------------------------
// 10. Lambda 핸들러 내보내기
// ---------------------------
export const handler = handle(app);
