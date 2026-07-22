type LoginActionResult = {
  success: boolean;
  error?: string;
};

type SubmitLoginFormInput = {
  username: string;
  password: string;
  login: (username: string, password: string) => Promise<LoginActionResult>;
  onSuccess: () => void;
  setError: (message: string) => void;
  setLoading: (loading: boolean) => void;
};

const LOGIN_REQUEST_ERROR = '登录请求失败，请刷新页面后重试';

export async function submitLoginForm({
  username,
  password,
  login,
  onSuccess,
  setError,
  setLoading,
}: SubmitLoginFormInput) {
  setError('');
  setLoading(true);

  try {
    const result = await login(username.trim(), password);

    if (result.success) {
      onSuccess();
      return;
    }

    setError(result.error || 'Login failed');
  } catch {
    setError(LOGIN_REQUEST_ERROR);
  }

  setLoading(false);
}
