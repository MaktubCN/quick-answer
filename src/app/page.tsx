'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Highlight, Prism } from 'prism-react-renderer';
import { themes } from 'prism-react-renderer';
import { getApiConfig } from '@/config/api';
import { useSearchParams } from 'next/navigation';

interface ChatMessage {
  id: string;
  transcription: string;
  answer: string;
  timestamp: number;
}

export default function Home() {
  const searchParams = useSearchParams();
  const API_CONFIG = getApiConfig(new URLSearchParams(searchParams.toString()));
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const answerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [currentAnswer]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        // 自动提交
        handleSubmit(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      // 重置当前对话
      setCurrentTranscription('');
      setCurrentAnswer('');
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (blob: Blob) => {
    if (!blob) return;

    setIsLoading(true);
    setIsStreaming(false);

    try {
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');

      // 转录音频
      const transcriptionResponse = await fetch(`${API_CONFIG.BASE_URL}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
        },
        body: formData,
      });

      const transcriptionData = await transcriptionResponse.json();
      const transcription = transcriptionData.text;
      setCurrentTranscription(transcription);

      // 获取AI回答
      const chatResponse = await fetch(`${API_CONFIG.BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: API_CONFIG.LLM,
          messages: [
            { role: 'system', content: API_CONFIG.SYS_PROMPT },
            { role: 'user', content: `${API_CONFIG.PROMPT}\n\n${transcription}` }
          ],
          stream: true,
        }),
      });

      let fullAnswer = '';
      setCurrentAnswer('');
      setIsStreaming(true);
      const reader = chatResponse.body?.getReader();
      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullAnswer += content;
                setCurrentAnswer(fullAnswer);
                // 添加打字机效果
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      }

      // 添加到历史记录
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        transcription,
        answer: fullAnswer,
        timestamp: Date.now(),
      };
      setChatHistory(prev => [newMessage, ...prev]);

    } catch (error) {
      console.error('Error processing audio:', error);
      setCurrentAnswer('Error processing your request. Please try again.');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setAudioBlob(null);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Recording Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            onTouchStart={isRecording ? stopRecording : startRecording}
            className={`flex items-center px-6 py-3 rounded-lg min-w-[120px] ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800' 
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            } text-white transition-all touch-manipulation`}
            style={{ 
              minHeight: '48px',
              touchAction: 'manipulation'
            }}
          >
            <svg
              className={`w-5 h-5 mr-2 ${isRecording ? 'animate-pulse' : ''}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            {isRecording ? '停止录音' : '开始录音'}
          </button>
        </div>

        {/* Current Conversation */}
        {(currentTranscription || currentAnswer) && (
          <div className="space-y-6 mb-8">
            {/* Transcription */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-2">当前录音转文字</h2>
              <p className="text-gray-200">
                {currentTranscription || '等待录音...'}
              </p>
            </div>

            {/* AI Response */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-2">AI回答</h2>
              <div 
                ref={answerRef}
                className="prose prose-invert max-w-none text-gray-200"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {isLoading ? '正在思考...' : currentAnswer || '等待回答...'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-white px-2">对话记录</h2>
            {chatHistory.map((message) => (
              <div key={message.id} className="bg-gray-800 rounded-lg">
                <div className="p-4 space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-gray-400">问题</h3>
                      <span className="text-sm text-gray-500">
                        {new Date(message.timestamp).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-gray-200">{message.transcription}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">回答</h3>
                    <div className="prose prose-invert max-w-none text-gray-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.answer}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-500">
            使用 Next.js, Tailwind CSS 和 OpenAI API 构建
          </p>
        </div>
      </footer>
    </div>
  );
}