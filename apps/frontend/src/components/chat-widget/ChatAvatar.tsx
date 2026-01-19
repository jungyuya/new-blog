// 파일 위치: apps/frontend/src/components/chat-widget/ChatAvatar.tsx
import Image from 'next/image';

interface ChatAvatarProps {
  role: 'user' | 'assistant';
}

const ChatAvatar = ({ role }: ChatAvatarProps) => {
  // assistant는 봇 아이콘, user는 기본 사람 아이콘 사용
  const src = role === 'assistant' ? '/deepdive-logo.png' : '/default-avatar.png';
  const alt = role === 'assistant' ? 'AI Assistant' : 'User';

  return (
    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-white shadow-sm">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        unoptimized // 로컬 이미지를 사용할 경우 최적화 건너뛰기
      />
    </div>
  );
};

export default ChatAvatar;