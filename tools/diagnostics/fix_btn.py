import psycopg2
import os

conn_str = os.environ.get("DATABASE_URL", "postgres://neondb_owner:YOUR_DB_PASSWORD@your-neon-host.neon.tech/neondb?sslmode=require")
conn = psycopg2.connect(conn_str)
cur = conn.cursor()

cur.execute("""
UPDATE "TenantSettings"
SET "CurrentSequence" = "CurrentSequence" + 1
""")
conn.commit()
print("Secuencia incrementada.")

cur.close()
conn.close()
