
  # Web App

  This is a code bundle for Web App. The original project is available at https://www.figma.com/design/ABPy6LtGH5xbmvRhVzyQEX/Web-App.

  ## Running the code

  ## Run `npm run dev` to start the development server. 
  
  Run `python -m pip install -r requirements.txt` from within \Backend to install Backend the dependencies
  
  Run `npm i` from \FrontEnd to install Frontend the dependencies.

  Run `python manage.py runserver` to start the development server. #python manage.py createsuperuser before acessing server

  Run `npm run build` to for upgrade in frontend. #on linux make sure OSView.tsx is renamed to OsView.tsx, case sensitive

  run `python manage.py makemigrations` to create table entries

  run `python manage.py migrate ComercialApp` to create entries just for ComercialApp

  run `git checkout ERP-Linave/main -- FrontEnd` to update frontend


  ## Creating a database for testing:
  1.Instale MySQL
    sudo apt update
    sudo apt install mysql-server -y
    sudo systemctl start mysql

  2.Crie a database e login padrão
    CREATE DATABASE linave_erp_db;
    CREATE USER 'username'@'localhost' IDENTIFIED BY 'password123';
    GRANT ALL PRIVILEGES ON db_name.* TO 'username'@'localhost';
    FLUSH PRIVILEGES;
    EXIT;

  3.Insira credenciais em settings.py localizado em /home/user/ERP-Linave-main/BackEnd/ERP_Linave_BackEnd/
    DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'db_name',
        'USER': 'username',
        'PASSWORD': 'password123',
        'HOST': 'localhost',
        'PORT': '3306',
        }
      }

  x.Limpeza pós teste:
    sudo mysql -e "DROP DATABASE db_name;" #deleta a database, mantém drivers

    sudo apt purge mysql-server mysql-common && sudo rm -rf /var/lib/mysql #remove todos os arquivos relacionados ao mysql