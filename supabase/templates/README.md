# Modelos de e-mail do Supabase (Lauda)

Cole cada modelo no painel do Supabase, no projeto Lauda:
**Authentication → Emails → Templates**. Em cada modelo, troque o
**Subject** e cole o HTML no campo do corpo (aba "Source"), depois salve.

| Modelo no Supabase | Subject | Arquivo |
|---|---|---|
| Confirm sign up | `Confirme seu cadastro na Lauda` | `confirmar-cadastro.html` |
| Reset password | `Crie uma nova senha na Lauda` | `nova-senha.html` |
| Change email address | `Confirme seu novo e-mail na Lauda` | `trocar-email.html` |

Os textos entre `{{ }}` são preenchidos pelo Supabase: `{{ .ConfirmationURL }}`
(link de confirmação), `{{ .Email }}`, `{{ .NewEmail }}` e `{{ .SiteURL }}`.

Os e-mails saem pelo Resend como `nao-responda@laudapdf.com.br`
(Authentication → Emails → SMTP Settings).
