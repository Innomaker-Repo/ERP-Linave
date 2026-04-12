import pymysql

# Força o PyMySQL a dizer ao Django que ele é uma versão moderna
pymysql.version_info = (2, 2, 1, "final", 0)
pymysql.install_as_MySQLdb()