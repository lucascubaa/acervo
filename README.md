# 📚 Acervo Library System

Sistema de gerenciamento de biblioteca desenvolvido em Flask.

## 🚀 Deploy no Render

### Passo a Passo:

1. **Faça commit das mudanças no GitHub:**
   ```bash
   git add .
   git commit -m "Preparar para deploy no Render"
   git push origin main
   ```

2. **Crie uma conta no Render:**
   - Acesse: https://render.com
   - Faça login com sua conta GitHub

3. **Criar novo Web Service:**
   - Clique em "New +" → "Web Service"
   - Conecte seu repositório GitHub `acervo`
   - O Render detectará automaticamente o `render.yaml`

4. **Configurações automáticas:**
   - ✅ Build Command: `pip install -r requirements.txt`
   - ✅ Start Command: `gunicorn -w 4 -b 0.0.0.0:$PORT acervoLibrarySystem.app:app`
   - ✅ Python Version: 3.12.0

5. **Clique em "Create Web Service"**
   - O deploy começará automaticamente
   - Aguarde 2-5 minutos

6. **Seu site estará online em:**
   - `https://acervo-library-system.onrender.com` (ou similar)

## 🔧 Variáveis de Ambiente

O Render gerará automaticamente:
- `FLASK_SECRET_KEY`: Chave secreta para sessões

## 📝 Observações

- O plano gratuito do Render hiberna após 15 minutos de inatividade
- A primeira requisição após hibernação pode demorar ~30 segundos
- O banco de dados SQLite será criado automaticamente no primeiro acesso

## 🔄 Atualizações Automáticas

Sempre que você fizer push para o GitHub, o Render fará deploy automático!

```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

## 🌐 Acesso Local

Para rodar localmente:
```bash
pip install -r requirements.txt
python acervoLibrarySystem/app.py
```

Acesse: http://localhost:5000
