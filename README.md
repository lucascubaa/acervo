# 📚 Acervo Library System

Sistema de gerenciamento de biblioteca desenvolvido em Flask.

## 🚀 Deploy no Railway

### Passo a Passo:

1. **Faça commit das mudanças no GitHub:**
   ```bash
   git add .
   git commit -m "Preparar para deploy no Railway"
   git push origin main
   ```

2. **Crie uma conta no Railway:**
   - Acesse: https://railway.app
   - Faça login com sua conta GitHub
   - **NÃO PRECISA DE CARTÃO!** ✅

3. **Criar novo Projeto:**
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha o repositório `acervo`

4. **Configurações automáticas:**
   - O Railway detectará automaticamente que é Python/Flask
   - ✅ Build Command: `pip install -r requirements.txt`
   - ✅ Start Command: `gunicorn -w 4 -b 0.0.0.0:$PORT acervoLibrarySystem.app:app`
   - ✅ Python Version: 3.12

5. **Configurar Variável de Ambiente:**
   - Vá em "Variables"
   - Adicione: `FLASK_SECRET_KEY` = `seu-valor-secreto-aqui`

6. **Deploy Automático:**
   - O deploy começará automaticamente
   - Aguarde 2-5 minutos

7. **Seu site estará online em:**
   - `https://seu-projeto.up.railway.app`
   - Você encontra a URL em "Settings" → "Domains"

## 🔧 Variáveis de Ambiente

Configure no Railway:
- `FLASK_SECRET_KEY`: Chave secreta para sessões (gere uma aleatória)

## 📝 Observações

- ✅ **500 horas/mês grátis** (suficiente para uso normal)
- ✅ **Sem cartão de crédito necessário**
- ✅ Deploy automático a cada push no GitHub
- ✅ HTTPS incluído
- O banco de dados SQLite será criado automaticamente no primeiro acesso

## 🔄 Atualizações Automáticas

Sempre que você fizer push para o GitHub, o Railway fará deploy automático!

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
