// 파일 위치: apps/frontend/src/components/chat-widget/MessageItem.tsx
import { format } from 'date-fns';
import ChatAvatar from './ChatAvatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: { title: string; url: string }[];
}

interface MessageItemProps {
  message: ChatMessage;
}

const MessageItem = ({ message }: MessageItemProps) => {
  const isMe = message.role === 'user';
  const formattedTime = format(message.timestamp, 'p');

  return (
    <div className={`flex gap-3 mb-4 ${isMe ? 'flex-row-reverse animate-slide-in-right' : 'animate-slide-in-left'}`}>

      <div className="w-10 shrink-0">
        <ChatAvatar role={message.role} />
      </div>

      <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <span className="text-xs text-gray-500 mb-1 ml-1">👑 JUNGYU's AI</span>
        )}

        <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
          <div
            className={`px-4 py-3 rounded-2xl break-words text-sm leading-relaxed shadow-sm ${isMe
              ? 'bg-chat-primary text-white rounded-tr-none'
              : 'bg-white text-chat-text-dark rounded-tl-none border border-gray-100'
              }`}
          >
            {isMe ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        {...props}
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '13px' }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code {...props} className={`${className} bg-gray-100 text-red-500 rounded px-1 py-0.5 text-xs font-mono`}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}

            {/* 출처 표시 영역 */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100/50">
                <p className="text-[11px] text-gray-400 font-medium mb-1.5 flex items-center gap-1">
                  👉️ 관련 포스팅
                </p>
                <ul className="space-y-1">
                  {message.sources.map((source, idx) => (
                    <li key={idx}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 truncate block max-w-full"
                      >
                        📄 {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 whitespace-nowrap mb-1">{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;