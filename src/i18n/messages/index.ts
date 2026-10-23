import { common, nav, cat, enums } from './common';
import { auth } from './auth';
import { tx } from './tx';
import { onb } from './onb';
import { dash } from './dash';
import { an } from './an';
import { bud } from './bud';
import { rec } from './rec';
import { goals } from './goals';
import { debts } from './debts';
import { acc } from './acc';
import { plan } from './plan';
import { set } from './set';
import { land } from './land';
import { admin } from './admin';

/**
 * Each namespace is `{ ru, kk, en }` with flat string keys.
 * Use as t('<namespace>.<key>'). Plural forms are separated by "|" and need a `count` var.
 */
export const MESSAGES = {
  common, nav, cat, enums, auth, tx, onb, dash, an, bud, rec, goals, debts, acc, plan, set, land, admin,
};
