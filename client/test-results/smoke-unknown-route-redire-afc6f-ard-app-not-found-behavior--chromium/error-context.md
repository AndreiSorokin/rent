# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "Вход" [level=1] [ref=e4]
    - textbox "Email" [ref=e5]
    - textbox "Пароль" [ref=e6]
    - button "Войти" [ref=e7]
    - paragraph [ref=e8]:
      - link "Забыли пароль?" [ref=e9] [cursor=pointer]:
        - /url: /forgot-password
    - paragraph [ref=e10]:
      - text: Нет аккаунта?
      - link "Зарегистрироваться" [ref=e11] [cursor=pointer]:
        - /url: /register
  - button "Open Next.js Dev Tools" [ref=e17] [cursor=pointer]:
    - img [ref=e18]
  - alert [ref=e21]
```