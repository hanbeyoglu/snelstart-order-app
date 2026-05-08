import i18n from '../index';

export function getApiErrorMessage(error: unknown, fallbackKey = 'errors:generic') {
  const maybeAxiosError = error as {
    response?: { data?: { message?: string; error?: string; code?: string } };
    message?: string;
  };

  const code = maybeAxiosError.response?.data?.code;
  if (code) {
    const translated = i18n.t(`errors:api.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }

  return (
    maybeAxiosError.response?.data?.message ||
    maybeAxiosError.response?.data?.error ||
    maybeAxiosError.message ||
    i18n.t(fallbackKey)
  );
}
