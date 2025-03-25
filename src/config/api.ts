export const getApiConfig = (searchParams: URLSearchParams | ReadonlyURLSearchParams = new URLSearchParams()) => {
  return {
    BASE_URL: searchParams.get('base_url') || '',
    API_KEY: searchParams.get('api_key') || '',
    LLM: 'gpt-4o',
    PROMPT: '请用简洁明了的中文回答这个问题，回答需包含清晰的逻辑结构和必要的细节，同时保持口语化。如果问题涉及步骤指导，请分点列出。',
    SYS_PROMPT: '你是一个专业的人工智能助手，擅长用清晰简洁的方式解答各种问题。'
  };
};