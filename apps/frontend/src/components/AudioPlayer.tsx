// 파일 위치: apps/frontend/src/components/AudioPlayer.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Settings, SkipBack, SkipForward, Download, Share2, Maximize2, Minimize2 } from 'lucide-react';
import type { Post } from '@/utils/api';

// 컴포넌트가 받을 props 타입을 정의합니다.
interface AudioPlayerProps {
    post: Post;
    showPlayer: boolean;
}

const AudioPlayer = ({ post, showPlayer }: AudioPlayerProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [bufferedPercent, setBufferedPercent] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    // 오디오 설정 업데이트
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
            audioRef.current.playbackRate = playbackRate;
        }
    }, [volume, isMuted, playbackRate]);

    const handlePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(error => console.error("Audio play failed:", error));
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.buffered.length > 0) {
                const bufferedEnd = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
                setBufferedPercent((bufferedEnd / audioRef.current.duration) * 100);
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = Number(e.target.value);
        setCurrentTime(newTime);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    const skipTime = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
        }
    };

    const handleShare = () => {
        // TODO: 공유 기능 구현 (예: 클립보드 복사)
        console.log('Share audio');
    };

    const handleDownload = () => {
        if (post.speechUrl) {
            const a = document.createElement('a');
            a.href = post.speechUrl;
            a.download = `${post.title || 'audio'}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const progressPercent = duration ? (currentTime / duration) * 100 : 0;

    return (
        <AnimatePresence>
            {showPlayer && post.speechUrl && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`mt-6 ${isMinimized ? 'p-3' : 'p-6'} bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700`}
                >
                    {/* 헤더 - 최소화 토글 */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Audio Player</span>
                        </div>
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                        </button>
                    </div>

                    {!isMinimized && (
                        <>
                            {/* 웨이브폼 비주얼라이저 (장식용) */}
                            <div className="hidden md:flex items-center justify-center space-x-1 mb-6 h-16">
                                {Array.from({ length: 40 }).map((_, i) => (
                                    <motion.div
                                        key={i}
                                        className="w-1 bg-gradient-to-t from-blue-400 to-purple-500 rounded-full"
                                        animate={{
                                            height: isPlaying ? [16, Math.random() * 48 + 16, 16] : 16,
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            repeat: Infinity,
                                            delay: i * 0.05,
                                        }}
                                    />
                                ))}
                            </div>

                            {/* 시간 표시 */}
                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                                    {formatTime(currentTime)}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                    {playbackRate !== 1 && `${playbackRate}x`}
                                </span>
                                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                                    {formatTime(duration)}
                                </span>
                            </div>
                        </>
                    )}

                    {/* 프로그레스 바 */}
                    <div className="relative mb-6 group">
                        <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="absolute h-full bg-gray-300 dark:bg-gray-600 rounded-full"
                                style={{ width: `${bufferedPercent}%` }}
                            />
                            <div
                                className="absolute h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
                            aria-label="재생 위치 조절"
                        />
                        <div
                            className="absolute h-4 w-4 bg-white dark:bg-gray-200 rounded-full shadow-lg border-2 border-blue-500 -top-1 transition-all group-hover:scale-110"
                            style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
                        />
                    </div>

                    {/* 컨트롤 버튼 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <button onClick={() => skipTime(-10)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all hover:scale-110" aria-label="10초 되감기">
                                <SkipBack className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </button>
                            <button onClick={handlePlayPause} className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white shadow-lg hover:shadow-xl transition-all hover:scale-110" aria-label={isPlaying ? '일시정지' : '재생'}>
                                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                            </button>
                            <button onClick={() => skipTime(10)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all hover:scale-110" aria-label="10초 앞으로">
                                <SkipForward className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </button>
                        </div>

                        <div className="flex items-center space-x-2">
                            <div className="hidden md:flex items-center space-x-2 mr-2">
                                <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-gray-600 dark:text-gray-400" /> : <Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
                                </button>
                                <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }} className="w-20 h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider" aria-label="음량 조절" />
                            </div>
                            <button onClick={handleShare} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all" aria-label="공유">
                                <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </button>
                            <button onClick={handleDownload} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all" aria-label="다운로드">
                                <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </button>
                            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-2 rounded-full transition-all ${isSettingsOpen ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} aria-label="설정">
                                <Settings className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* 설정 패널 */}
                    <AnimatePresence>
                        {isSettingsOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                transition={{ duration: 0.3 }}
                                className="border-t border-gray-200 dark:border-gray-700 pt-4"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">재생 속도</span>
                                        <span className="text-sm font-mono text-gray-500 dark:text-gray-400">{playbackRate.toFixed(2)}x</span>
                                    </div>
                                    <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                                        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                                            <button key={rate} onClick={() => setPlaybackRate(rate)} className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${playbackRate === rate ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                                                {rate}x
                                            </button>
                                        ))}
                                    </div>
                                    <input type="range" min={0.25} max={2.5} step={0.05} value={playbackRate} onChange={(e) => setPlaybackRate(Number(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider" />
                                    <div className="md:hidden space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">음량</span>
                                            <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                                                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider" />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <audio
                        ref={audioRef}
                        src={post.speechUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                    />

                    <style jsx>{`
            .slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 16px;
              height: 16px;
              background: white;
              border: 2px solid #60a5fa; /* blue-400 */
              border-radius: 50%;
              cursor: pointer;
              transition: transform 0.2s ease-in-out;
            }
            .slider::-webkit-slider-thumb:hover {
              transform: scale(1.2);
            }
            .slider::-moz-range-thumb {
              width: 16px;
              height: 16px;
              background: white;
              border: 2px solid #60a5fa;
              border-radius: 50%;
              cursor: pointer;
              transition: transform 0.2s ease-in-out;
            }
            .slider::-moz-range-thumb:hover {
              transform: scale(1.2);
            }
          `}</style>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AudioPlayer;