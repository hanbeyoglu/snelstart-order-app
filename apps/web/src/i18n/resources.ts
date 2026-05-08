import trCommon from './locales/tr/common.json';
import trAuth from './locales/tr/auth.json';
import trDashboard from './locales/tr/dashboard.json';
import trProducts from './locales/tr/products.json';
import trCart from './locales/tr/cart.json';
import trCheckout from './locales/tr/checkout.json';
import trSettings from './locales/tr/settings.json';
import trCategories from './locales/tr/categories.json';
import trCustomers from './locales/tr/customers.json';
import trUsers from './locales/tr/users.json';
import trReports from './locales/tr/reports.json';
import trOrders from './locales/tr/orders.json';
import trValidation from './locales/tr/validation.json';
import trErrors from './locales/tr/errors.json';
import trNotifications from './locales/tr/notifications.json';
import trLegacy from './locales/tr/legacy.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enProducts from './locales/en/products.json';
import enCart from './locales/en/cart.json';
import enCheckout from './locales/en/checkout.json';
import enSettings from './locales/en/settings.json';
import enCategories from './locales/en/categories.json';
import enCustomers from './locales/en/customers.json';
import enUsers from './locales/en/users.json';
import enReports from './locales/en/reports.json';
import enOrders from './locales/en/orders.json';
import enValidation from './locales/en/validation.json';
import enErrors from './locales/en/errors.json';
import enNotifications from './locales/en/notifications.json';
import enLegacy from './locales/en/legacy.json';

import nlCommon from './locales/nl/common.json';
import nlAuth from './locales/nl/auth.json';
import nlDashboard from './locales/nl/dashboard.json';
import nlProducts from './locales/nl/products.json';
import nlCart from './locales/nl/cart.json';
import nlCheckout from './locales/nl/checkout.json';
import nlSettings from './locales/nl/settings.json';
import nlCategories from './locales/nl/categories.json';
import nlCustomers from './locales/nl/customers.json';
import nlUsers from './locales/nl/users.json';
import nlReports from './locales/nl/reports.json';
import nlOrders from './locales/nl/orders.json';
import nlValidation from './locales/nl/validation.json';
import nlErrors from './locales/nl/errors.json';
import nlNotifications from './locales/nl/notifications.json';
import nlLegacy from './locales/nl/legacy.json';

import deCommon from './locales/de/common.json';
import deAuth from './locales/de/auth.json';
import deDashboard from './locales/de/dashboard.json';
import deProducts from './locales/de/products.json';
import deCart from './locales/de/cart.json';
import deCheckout from './locales/de/checkout.json';
import deSettings from './locales/de/settings.json';
import deCategories from './locales/de/categories.json';
import deCustomers from './locales/de/customers.json';
import deUsers from './locales/de/users.json';
import deReports from './locales/de/reports.json';
import deOrders from './locales/de/orders.json';
import deValidation from './locales/de/validation.json';
import deErrors from './locales/de/errors.json';
import deNotifications from './locales/de/notifications.json';
import deLegacy from './locales/de/legacy.json';

import arCommon from './locales/ar/common.json';
import arAuth from './locales/ar/auth.json';
import arDashboard from './locales/ar/dashboard.json';
import arProducts from './locales/ar/products.json';
import arCart from './locales/ar/cart.json';
import arCheckout from './locales/ar/checkout.json';
import arSettings from './locales/ar/settings.json';
import arCategories from './locales/ar/categories.json';
import arCustomers from './locales/ar/customers.json';
import arUsers from './locales/ar/users.json';
import arReports from './locales/ar/reports.json';
import arOrders from './locales/ar/orders.json';
import arValidation from './locales/ar/validation.json';
import arErrors from './locales/ar/errors.json';
import arNotifications from './locales/ar/notifications.json';
import arLegacy from './locales/ar/legacy.json';

export const resources = {
  tr: {
    common: trCommon,
    auth: trAuth,
    dashboard: trDashboard,
    products: trProducts,
    cart: trCart,
    checkout: trCheckout,
    settings: trSettings,
    categories: trCategories,
    customers: trCustomers,
    users: trUsers,
    reports: trReports,
    orders: trOrders,
    validation: trValidation,
    errors: trErrors,
    notifications: trNotifications,
    legacy: trLegacy,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    products: enProducts,
    cart: enCart,
    checkout: enCheckout,
    settings: enSettings,
    categories: enCategories,
    customers: enCustomers,
    users: enUsers,
    reports: enReports,
    orders: enOrders,
    validation: enValidation,
    errors: enErrors,
    notifications: enNotifications,
    legacy: enLegacy,
  },
  nl: {
    common: nlCommon,
    auth: nlAuth,
    dashboard: nlDashboard,
    products: nlProducts,
    cart: nlCart,
    checkout: nlCheckout,
    settings: nlSettings,
    categories: nlCategories,
    customers: nlCustomers,
    users: nlUsers,
    reports: nlReports,
    orders: nlOrders,
    validation: nlValidation,
    errors: nlErrors,
    notifications: nlNotifications,
    legacy: { ...enLegacy, ...nlLegacy },
  },
  de: {
    common: deCommon,
    auth: deAuth,
    dashboard: deDashboard,
    products: deProducts,
    cart: deCart,
    checkout: deCheckout,
    settings: deSettings,
    categories: deCategories,
    customers: deCustomers,
    users: deUsers,
    reports: deReports,
    orders: deOrders,
    validation: deValidation,
    errors: deErrors,
    notifications: deNotifications,
    legacy: { ...enLegacy, ...deLegacy },
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    dashboard: arDashboard,
    products: arProducts,
    cart: arCart,
    checkout: arCheckout,
    settings: arSettings,
    categories: arCategories,
    customers: arCustomers,
    users: arUsers,
    reports: arReports,
    orders: arOrders,
    validation: arValidation,
    errors: arErrors,
    notifications: arNotifications,
    legacy: { ...enLegacy, ...arLegacy },
  },
} as const;

export type AppResources = typeof resources;
