Como permitir que outros usuários na mesma rede usem o backend e o banco de dados

Resumo rápido:
- O frontend agora salva e carrega dados de workspace (clientes, empresa, etc.) através do endpoint:
  `/comercial/workspaces/<admin_email>/`
- Para que outros usuários na rede acessem esses dados, o backend Django precisa estar acessível na rede (não apenas `localhost`).

Passos recomendados:

1) Execute o servidor Django ligado a todas as interfaces (0.0.0.0) e porta 8000:

   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

   - Isso faz com que o Django responda em `http://<IP_DO_SERVIDOR>:8000/` para outras máquinas na mesma rede.

2) Abra a porta no firewall do sistema (Windows Firewall, ufw, etc.) para permitir acesso à porta 8000.

3) Acesse o frontend a partir de outro computador apontando o navegador para o IP do host do frontend (por exemplo `http://192.168.0.10:5173` se estiver usando `npm run dev` do Vite). O frontend fará requisições ao backend no mesmo host (mesmo hostname) na porta 8000.

4) Observações sobre o banco de dados:
   - O backend se conecta ao banco de dados configurado em `ERP_Linave_BackEnd/settings.py` (atualmente MySQL com host `localhost`).
   - Outros usuários não precisam acessar o banco de dados diretamente; eles usam a API do Django. Isso é mais seguro e recomendado.
   - Se você quiser permitir conexões diretas ao MySQL a partir de outras máquinas (não recomendado), será necessário:
     - Configurar o MySQL para escutar em `0.0.0.0` (arquivo `mysqld.cnf`/`my.cnf`) e permitir o usuário remoto.
     - Abrir a porta 3306 no firewall.

5) CORS e ALLOWED_HOSTS
   - O projeto já possui `CORS_ALLOW_ALL_ORIGINS = True` e `ALLOWED_HOSTS` inclui `*` no `settings.py` por padrão de desenvolvimento, então não são necessárias mudanças adicionais para testes locais.

6) Segurança
   - Estas instruções são adequadas para um ambiente de desenvolvimento/lan privada. Para produção, configure um servidor WSGI (Gunicorn/uvicorn), SSL/TLS, autenticação e regras de firewall adequadas.

Se quiser, posso automatizar um script PowerShell/Batch para iniciar o backend e abrir a porta no firewall do Windows. Deseja isso?