import sqlite3

conn = sqlite3.connect('database/scheduling.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

project_id = 4

# Check if project exists
cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
project = cursor.fetchone()
if project:
    print(f'Project found: {dict(project)}')
else:
    print(f'Project {project_id} not found')
    exit()

# Check bookings for this project
cursor.execute('SELECT * FROM project_bookings WHERE project_id = ?', (project_id,))
bookings = cursor.fetchall()
print(f'\nTotal bookings for project {project_id}: {len(bookings)}')
for booking in bookings:
    print(f'  Booking: {dict(booking)}')

# Try the full query with joins
query = '''
    SELECT pb.*, e.full_name, e.department, e.employee_id, 
           es.available_hours_per_month
    FROM project_bookings pb
    JOIN employees e ON pb.employee_id = e.id
    LEFT JOIN employee_schedules es ON pb.employee_id = es.employee_id 
        AND pb.month = es.month AND pb.year = es.year
    WHERE pb.project_id = ?
    ORDER BY pb.year DESC, pb.month DESC
'''

try:
    cursor.execute(query, (project_id,))
    results = cursor.fetchall()
    print(f'\nQuery with joins returned {len(results)} results:')
    for row in results:
        print(f'  {dict(row)}')
except Exception as e:
    print(f'\nError executing query: {e}')

# Check employees table structure
cursor.execute("PRAGMA table_info(employees)")
print('\nEmployees table structure:')
for col in cursor.fetchall():
    print(f'  {dict(col)}')

# Check project_bookings table structure  
cursor.execute("PRAGMA table_info(project_bookings)")
print('\nProject_bookings table structure:')
for col in cursor.fetchall():
    print(f'  {dict(col)}')

conn.close()
