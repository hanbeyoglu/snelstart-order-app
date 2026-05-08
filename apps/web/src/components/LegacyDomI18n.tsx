import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { legacyTextKeyMap } from '../i18n/legacyDomMap';

const translatedTextNodes = new WeakMap<Text, string>();
const translatedAttributes = new WeakMap<Element, Record<string, string>>();
const attributes = ['placeholder', 'title', 'aria-label'] as const;

function getTranslatedValue(value: string, t: (key: string) => string) {
  const key = legacyTextKeyMap[value.trim()];
  return key ? t(`legacy:${key}`) : null;
}

function translateElement(root: ParentNode, t: (key: string) => string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let node = walker.nextNode() as Text | null;
  while (node) {
    const original = translatedTextNodes.get(node) || node.textContent || '';
    const translated = getTranslatedValue(original, t);
    if (translated) {
      translatedTextNodes.set(node, original);
      const leading = original.match(/^\s*/)?.[0] || '';
      const trailing = original.match(/\s*$/)?.[0] || '';
      node.textContent = `${leading}${translated}${trailing}`;
    }
    node = walker.nextNode() as Text | null;
  }

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll('*'))] : Array.from(root.querySelectorAll('*'));
  for (const element of elements) {
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (!value) continue;

      const originals = translatedAttributes.get(element) || {};
      const original = originals[attribute] || value;
      const translated = getTranslatedValue(original, t);
      if (translated) {
        translatedAttributes.set(element, { ...originals, [attribute]: original });
        if (value !== translated) {
          element.setAttribute(attribute, translated);
        }
      }
    }
  }
}

export default function LegacyDomI18n() {
  const { t, i18n } = useTranslation('legacy');

  useEffect(() => {
    const run = () => translateElement(document.body, t);
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = (message?: string) => {
      const translated = typeof message === 'string' ? getTranslatedValue(message, t) : null;
      return originalAlert.call(window, translated || message);
    };
    window.confirm = (message?: string) => {
      const translated = typeof message === 'string' ? getTranslatedValue(message, t) : null;
      return originalConfirm.call(window, translated || message);
    };

    run();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            translateElement(node.nodeType === Node.TEXT_NODE ? node.parentNode || document.body : (node as Element), t);
          }
        });
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          translateElement(mutation.target, t);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: attributes as unknown as string[],
    });

    return () => {
      observer.disconnect();
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [i18n.language, t]);

  return null;
}
