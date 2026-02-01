from controllers.dashboard_controller import DashboardController
import json

# Test the dashboard controller directly
result = DashboardController.get_projects_dashboard()
print("Dashboard Response:")
print(json.dumps(result, indent=2, default=str))
