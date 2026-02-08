import sqlite3

conn = sqlite3.connect('database/scheduling.db')
cursor = conn.cursor()

# Check projects
projects_count = cursor.execute('SELECT COUNT(*) FROM projects').fetchone()[0]
print(f'Total Projects: {projects_count}')

# Check bookings
bookings_count = cursor.execute('SELECT COUNT(*) FROM project_bookings').fetchone()[0]
print(f'Total Bookings: {bookings_count}')

# Check project status breakdown
cursor.execute("SELECT status, COUNT(*) FROM projects GROUP BY status")
print('\nProjects by status:')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]}')

# Sample projects
cursor.execute('SELECT id, name, status, progress FROM projects LIMIT 5')
print('\nSample projects:')
for row in cursor.fetchall():
    print(f'  ID: {row[0]}, Name: {row[1]}, Status: {row[2]}, Progress: {row[3]}%')

conn.close()
