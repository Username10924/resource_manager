import sqlite3

conn = sqlite3.connect('database/scheduling.db')
cursor = conn.cursor()

# Update the project to have omars (ID 11) as the architect
cursor.execute("UPDATE projects SET solution_architect_id = 11 WHERE id = 4")
conn.commit()

print("Updated project 4 to have solution_architect_id = 11 (omar xa)")

# Verify
cursor.execute("SELECT id, name, solution_architect_id FROM projects WHERE id = 4")
result = cursor.fetchone()
print(f"Verified: Project {result[0]} - {result[1]} now has architect_id: {result[2]}")

conn.close()
