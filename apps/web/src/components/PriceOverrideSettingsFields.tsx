import { PRICE_OVERRIDE_PERMISSIONS } from '../utils/priceOverridePolicy';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import './PriceOverrideSettingsFields.css';

type Props = {
  role: string;
  permissions: string[];
  priceOverrideLimitPercent: string;
  onPermissionsChange: (permissions: string[]) => void;
  onLimitPercentChange: (value: string) => void;
};

export default function PriceOverrideSettingsFields({
  role,
  permissions,
  priceOverrideLimitPercent,
  onPermissionsChange,
  onLimitPercentChange,
}: Props) {
  const { t } = useAppTranslation(['users', 'common']);

  if (role === 'super_admin' || role === 'customer') {
    return null;
  }

  const hasFull = permissions.includes(PRICE_OVERRIDE_PERMISSIONS.full);
  const hasLimited = permissions.includes(PRICE_OVERRIDE_PERMISSIONS.limited);

  const setFull = (checked: boolean) => {
    const withoutOverride = permissions.filter(
      (p) => p !== PRICE_OVERRIDE_PERMISSIONS.full && p !== PRICE_OVERRIDE_PERMISSIONS.limited,
    );
    if (checked) {
      onPermissionsChange([...withoutOverride, PRICE_OVERRIDE_PERMISSIONS.full]);
      return;
    }
    onPermissionsChange(withoutOverride);
  };

  const setLimited = (checked: boolean) => {
    const withoutOverride = permissions.filter(
      (p) => p !== PRICE_OVERRIDE_PERMISSIONS.full && p !== PRICE_OVERRIDE_PERMISSIONS.limited,
    );
    if (checked) {
      onPermissionsChange([...withoutOverride, PRICE_OVERRIDE_PERMISSIONS.limited]);
      return;
    }
    onPermissionsChange(withoutOverride);
  };

  return (
    <section className="price-override-settings" aria-labelledby="price-override-settings-title">
      <h3 id="price-override-settings-title" className="price-override-settings__title">
        {t('users:priceOverride.sectionTitle')}
      </h3>

      <div className="price-override-settings__options" role="group" aria-label={t('users:priceOverride.sectionTitle')}>
        <label className="price-override-settings__checkbox-row">
          <input type="checkbox" checked={hasFull} onChange={(e) => setFull(e.target.checked)} />
          <span>{t('users:priceOverride.full')}</span>
        </label>

        <label className="price-override-settings__checkbox-row">
          <input
            type="checkbox"
            checked={hasLimited}
            disabled={hasFull}
            onChange={(e) => setLimited(e.target.checked)}
          />
          <span>{t('users:priceOverride.limited')}</span>
        </label>
      </div>

      <div className="price-override-settings__limit">
        <label htmlFor="priceOverrideLimitPercent" className="price-override-settings__limit-label">
          {t('users:priceOverride.limitPercent')}
        </label>
        <input
          id="priceOverrideLimitPercent"
          type="number"
          min={0}
          max={100}
          step={1}
          value={priceOverrideLimitPercent}
          disabled={hasFull || !hasLimited}
          required={hasLimited}
          onChange={(e) => onLimitPercentChange(e.target.value)}
          className="input price-override-settings__input"
        />
        <p className="price-override-settings__hint">{t('users:priceOverride.limitHint')}</p>
      </div>
    </section>
  );
}
