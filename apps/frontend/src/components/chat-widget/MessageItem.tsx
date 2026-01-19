// 파일 위치: apps/frontend/src/components/chat-widget/MessageItem.tsx
import { format } from 'date-fns';
import ChatAvatar from './ChatAvatar';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
        {!isMe && <ChatAvatar role="assistant" />}
      </div>

      <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <span className="text-xs text-gray-500 mb-1 ml-1">Deep Dive AI</span>
        )}

        <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
          <div
            className={`px-4 py-2.5 rounded-2xl break-words text-sm leading-relaxed shadow-sm ${
              isMe 
                ? 'bg-chat-primary text-white rounded-tr-none' 
                : 'bg-white text-chat-text-dark rounded-tl-none border border-gray-100'
            }`}
          >
            {message.content}
          </div>
          <span className="text-[10px] text-gray-400 whitespace-nowrap mb-1">{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;