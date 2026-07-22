import psycopg2

conn = psycopg2.connect("postgres://neondb_owner:npg_e2cg4MKubLUS@ep-blue-firefly-ait5ft4m.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()

cur.execute("""
    UPDATE "Sales"
    SET "NoteNumber" = NULL, 
        "SriErrorMessage" = 'Reintento manual habilitado', 
        "ElectronicStatus" = 'ERROR', 
        "IsElectronic" = true, 
        "AccessKey" = NULL, 
        "AuthorizationNumber" = NULL
    WHERE "Id" = 61
""")

print(f"Updated {cur.rowcount} rows.")
conn.commit()
cur.close()
conn.close()
