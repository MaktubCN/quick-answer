'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
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

function LoadingFallback() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}

function ChatComponent() {
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
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              {isRecording ? (
                <path d="M5.5 5.5A.5.5 0 016 6v12a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5h1zm3 0a.5.5 0 01.5.5v12a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5h1z"/>
              ) : (
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              )}
            </svg>
            {isRecording ? '停止录音' : '开始录音'}
          </button>
        </div>

        {/* Current Conversation */}
        <div className="mb-8">
          {currentTranscription && (
            <div className="mb-4 p-4 bg-gray-800 rounded-lg">
              <h3 className="text-gray-400 mb-2">你说：</h3>
              <p className="text-white">{currentTranscription}</p>
            </div>
          )}
          {(isLoading || currentAnswer) && (
            <div 
              ref={answerRef}
              className="p-4 bg-gray-800 rounded-lg overflow-auto"
              style={{ maxHeight: '400px' }}
            >
              <h3 className="text-gray-400 mb-2">AI 回答：</h3>
              {isLoading && !isStreaming && (
                <div className="flex items-center text-white">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                  处理中...
                </div>
              )}
              {currentAnswer && (
                <div className="text-white prose prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                          <Highlight
                            code={String(children).replace(/\n$/, '')}
                            language={match?.[1] || ''}
                            theme={themes.dracula}
                          >
                            {({ className, style, tokens, getLineProps, getTokenProps }) => (
                              <pre className={`${className} p-4 rounded overflow-auto`} style={style}>
                                {tokens.map((line, i) => (
                                  <div key={i} {...getLineProps({ line })}>
                                    {line.map((token, key) => (
                                      <span key={key} {...getTokenProps({ token })} />
                                    ))}
                                  </div>
                                ))}
                              </pre>
                            )}
                          </Highlight>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {currentAnswer}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat History */}
        <div className="space-y-6">
          {chatHistory.map((message) => (
            <div key={message.id} className="border-t border-gray-800 pt-6">
              <div className="mb-4 p-4 bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-gray-400">你说：</h3>
                  <span className="text-gray-500 text-sm">{formatTime(message.timestamp)}</span>
                </div>
                <p className="text-white">{message.transcription}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="text-gray-400 mb-2">AI 回答：</h3>
                <div className="text-white prose prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                          <Highlight
                            code={String(children).replace(/\n$/, '')}
                            language={match?.[1] || ''}
                            theme={themes.dracula}
                          >
                            {({ className, style, tokens, getLineProps, getTokenProps }) => (
                              <pre className={`${className} p-4 rounded overflow-auto`} style={style}>
                                {tokens.map((line, i) => (
                                  <div key={i} {...getLineProps({ line })}>
                                    {line.map((token, key) => (
                                      <span key={key} {...getTokenProps({ token })} />
                                    ))}
                                  </div>
                                ))}
                              </pre>
                            )}
                          </Highlight>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.answer}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChatComponent />
    </Suspense>
  );
}
