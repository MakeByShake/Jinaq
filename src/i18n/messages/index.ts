import { common, nav, cat, enums } from './common';
import { auth } from './auth';
import { tx } from './tx';
import { onb } from './onb';
import { dash } from './dash';

/**
 * Each namespace is `{ ru, kk, en }` with flat string keys.
 * Use as t('<namespace>.<key>'). Plural forms are separated by "|" and need a `count` var.
 */
export const MESSAGES = {
  common,
  nav,
  cat,
  enums,
  auth,
  tx,
  onb,
  dash,
};
