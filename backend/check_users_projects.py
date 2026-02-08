import sqlite3

conn = sqlite3.connect('database/scheduling.db')
cursor = conn.cursor()

# Check users
cursor.execute("SELECT id, username, role, full_name FROM users")
print("Users:")
for row in cursor.fetchall():
    print(f"  ID: {row[0]}, Username: {row[1]}, Role: {row[2]}, Name: {row[3]}")

# Check projects with their architect IDs
cursor.execute("SELECT id, name, status, solution_architect_id FROM projects")
print("\nProjects:")
for row in cursor.fetchall():
    print(f"  ID: {row[0]}, Name: {row[1]}, Status: {row[2]}, Architect ID: {row[3]}")

conn.close()
