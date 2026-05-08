import { useTranslation } from 'react-i18next';
import type { Namespace } from '../constants';

export function useAppTranslation(namespace?: Namespace | Namespace[]) {
  return useTranslation(namespace);
}
