# Jinaq Wallet — личные финансы

**Jinaq Wallet** (от каз. *жинақ* — «накопление») — PWA для учёта личных финансов: запись трат за 2 касания, «сколько можно тратить сегодня», бюджеты, цели и вишлист, долги с напоминаниями, регулярные платежи и аналитика. Интерфейс на русском, казахском и английском.

## Стек

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui · zustand · Firebase Auth + Firestore (офлайн-кэш) · recharts · date-fns.

## Запуск

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Нужен `.env.local` с ключами Firebase (`NEXT_PUBLIC_FIREBASE_*`). Для удаления пользователей из админки дополнительно нужны серверные ключи `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (сервисный аккаунт).

## Настройка Firebase

1. **Правила Firestore** — `firestore.rules`: `firebase deploy --only firestore:rules`.
2. **Вход через Google** — Firebase Console → Authentication → Sign-in method → включить Google; добавить домен сайта в Authorized domains.
3. **Первый администратор** — в Firestore у нужного документа `users/{uid}` поставить `role: "admin"`.

## Структура

```
src/
  app/                 страницы (лендинг, вход, /dashboard/*, /admin)
  components/app/      общие компоненты приложения (быстрое добавление, листы, графики, UI)
  components/layout/   боковая панель, нижняя навигация, шапка
  components/brand/    логотип
  lib/                 модель данных, действия с Firestore, финансовые расчёты, форматирование
  stores/              zustand: auth, данные, UI
  i18n/                переводы RU / KZ / EN (messages/<namespace>.ts)
public/brand/          логотип в SVG
```

### Модель данных (Firestore)

`users/{uid}` — профиль; подколлекции `accounts`, `categories`, `transactions`, `budgets`, `recurring`, `templates`, `debts`, `goals`, `meta/plan`.

Балансы **не хранятся** — они считаются из начального баланса счёта и операций, поэтому всегда сходятся с историей.
