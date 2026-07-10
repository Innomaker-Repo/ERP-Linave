------------- Commandos Docker Compose -------------------

- Criar ambiente: docker compose up -d --build
- Remover ambiente: docker compose down -v
- Limpar cache do builder: docker builder prune -f


- Checar logs de erro do docker da database: docker compose logs database
- Checar compose: docker compose ps


------------ Servidor -----------

- cat << EOF > .env : colar ; EOF ; chmod 600 .env
- touch acme.json : chmod 600 acme.json

----------- Conectar ------------

Frontend: https://vts-wlm.com.br

--------- Falta? ----------------
- Atualizar aplicação 
- Assegurar funcionamento
- Adicionar icone em frontend/public/favicon.ico

- chmod 600 .env e no novo acme gerado
