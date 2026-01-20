// 파일 위치: apps/frontend/src/components/chat-widget/MessageInput.tsx
import { useState, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { IoSend } from 'react-icons/io5';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const MessageInput = ({ onSendMessage, isLoading }: MessageInputProps) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    // 디바운싱: 이미 전송 중이면 무시
    if (isSubmitting || isLoading) {
      return;
    }

    if (input.trim()) {
      setIsSubmitting(true);
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // 300ms 후 다시 전송 가능
      setTimeout(() => setIsSubmitting(false), 300);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form className="p-3 border-t border-gray-100 bg-white flex items-center gap-2 rounded-b-2xl" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="질문을 입력하세요..."
        className="flex-grow resize-none overflow-y-auto bg-gray-100 rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-chat-primary focus:bg-white transition-all text-gray-700 placeholder-gray-400 disabled:opacity-50"
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        className={`p-2.5 rounded-full text-white transition-all duration-200 shadow-sm flex items-center justify-center ${input.trim() && !isLoading && !isSubmitting
            ? 'bg-chat-primary hover:bg-chat-primary-hover transform hover:scale-105 active:scale-95'
            : 'bg-gray-200 cursor-not-allowed'
          }`}
        disabled={!input.trim() || isLoading || isSubmitting}
        aria-label="전송"
      >
        <IoSend className="w-5 h-5 ml-0.5" />
      </button>
    </form>
  );
};

export default MessageInput;