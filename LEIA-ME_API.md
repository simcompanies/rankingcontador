# Correção da API — Google Apps Script

O erro observado não é causado necessariamente pela URL da API estar errada.

O endpoint `https://script.google.com/macros/s/.../exec` pode responder com um redirecionamento para `https://script.googleusercontent.com/...`.

O navegador aplica a política CSP também ao destino final do `fetch`. Por isso, permitir apenas `https://script.google.com` não é suficiente.

## Correção aplicada

O `connect-src` agora permite:

- `https://script.google.com`
- `https://script.googleusercontent.com`

A URL do Web App continua centralizada em `js/core/config-api.js`.

## Importante

O endereço `script.googleusercontent.com/macros/echo?...` exibido no Console é um destino interno/temporário do redirecionamento do Google Apps Script. Não deve ser copiado para `API_URL`.

Use sempre a URL `/macros/s/<DEPLOYMENT_ID>/exec` do Web App implantado.
