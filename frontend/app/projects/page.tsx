'use client';

import { useState, useEffect } from 'react';
import { projectAPI, employeeAPI, dashboardAPI, userAPI, Project, Employee, Booking, User } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import { formatMonth, getMonthsList } from '@/lib/utils';
import { SkeletonProjectsPage, Skeleton } from '@/components/Skeleton';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [projectBookings, setProjectBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsData, statsData] = await Promise.all([
        projectAPI.getAll(),
        dashboardAPI.getProjectStats(),
      ]);
      console.log('Projects Data:', projectsData);
      console.log('Stats Data:', statsData);
      setProjects(projectsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openProjectDetails = async (project: Project) => {
    setSelectedProject(project);
    setIsDetailsModalOpen(true);
    try {
      const bookings = await projectAPI.getBookings(project.id);
      setProjectBookings(bookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setProjectBookings([]);
    }
  };

  const openBookingModal = (project: Project) => {
    setSelectedProject(project);
    setIsBookingModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      await projectAPI.delete(selectedProject.id);
      setIsDeleteModalOpen(false);
      setSelectedProject(null);
      loadData();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project: ' + (error as Error).message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border border-emerald-200';
      case 'planning':
        return 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200';
      case 'completed':
        return 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-200';
      case 'on-hold':
        return 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200';
      default:
        return 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-200';
    }
  };

  if (loading) {
    return <SkeletonProjectsPage />;
  }

  return (
    <>
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Projects</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage projects and resource bookings
              </p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Project
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="py-6">
                <div className="text-sm font-medium text-gray-600">Total Projects</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total_projects || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <div className="text-sm font-medium text-gray-600">Active Projects</div>
                <div className="mt-2 text-3xl font-bold text-green-600">{stats.active_projects || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <div className="text-sm font-medium text-gray-600">Total Bookings</div>
                <div className="mt-2 text-3xl font-bold text-blue-600">{stats.total_bookings || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <div className="text-sm font-medium text-gray-600">Avg Progress</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{stats.avg_progress || 0}%</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Projects Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {projects.map((project) => (
            <div key={project.id} className="cursor-pointer" onClick={() => openProjectDetails(project)}>
              <Card className="transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{project.name}</CardTitle>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {project.description}
                      </p>
                    </div>
                    <span className={`ml-3 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium text-gray-900">{project.progress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                      className="flex-1"
                    >
                      Edit Project
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openBookingModal(project); }}
                      className="flex-1"
                    >
                      Book Resources
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openDeleteModal(project); }}
                      className="bg-red-100 text-red-800 hover:bg-red-200"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Create Project Modal */}
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={loadData}
        />

        {/* Edit Project Modal */}
        {selectedProject && (
          <EditProjectModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedProject(null);
            }}
            project={selectedProject}
            onUpdate={loadData}
          />
        )}

        {/* Booking Modal */}
        {selectedProject && (
          <BookingModal
            isOpen={isBookingModalOpen}
            onClose={() => {
              setIsBookingModalOpen(false);
              setSelectedProject(null);
            }}
            project={selectedProject}
            onBook={loadData}
          />
        )}

        {/* Delete Confirmation Modal */}
        {selectedProject && (
          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedProject(null);
            }}
            title="Delete Project"
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete the project <strong>{selectedProject.name}</strong>?
                This will also delete all associated bookings and cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedProject(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteProject}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Project
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Project Details Modal */}
        {selectedProject && (
          <ProjectDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedProject(null);
              setProjectBookings([]);
            }}
            project={selectedProject}
            bookings={projectBookings}
          />
        )}
    </>
  );
}

function CreateProjectModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  const [architects, setArchitects] = useState<User[]>([]);
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    project_code: '',
    name: '',
    description: '',
    solution_architect_id: 2, // ID 2 is Sarah Architect (first solution architect in DB)
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadArchitects();
    }
  }, [isOpen]);

  const loadArchitects = async () => {
    try {
      const data = await userAPI.getArchitects();
      setArchitects(data);
      if (data.length > 0 && !formData.solution_architect_id) {
        setFormData(prev => ({ ...prev, solution_architect_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error loading architects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convert date strings to proper format or null
      const payload = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };
      console.log('[CREATE] Creating project with payload:', payload);
      const response = await projectAPI.create(payload);
      console.log('[CREATE] Project created:', response);
      
      // Upload attachments if any - response contains {success: true, project: {...}}
      const projectId = response.project?.id || response.id;
      if (attachments.length > 0 && projectId) {
        console.log(`[CREATE] Uploading ${attachments.length} attachments for project ID:`, projectId);
        for (const file of attachments) {
          try {
            console.log('[CREATE] Uploading file:', file.name);
            const uploadResult = await projectAPI.uploadAttachment(projectId, file);
            console.log('[CREATE] Upload successful:', uploadResult);
          } catch (uploadError) {
            console.error('[CREATE] Error uploading file:', file.name, uploadError);
            alert(`Failed to upload ${file.name}: ${uploadError}`);
          }
        }
      } else {
        console.log('[CREATE] No attachments to upload or no project ID. Attachments:', attachments.length, 'Project ID:', projectId);
      }
      
      onCreate();
      onClose();
      setFormData({ 
        project_code: '',
        name: '', 
        description: '', 
        solution_architect_id: 2,
        start_date: '',
        end_date: '',
      });
      setAttachments([]);
    } catch (error) {
      console.error('[CREATE] Error creating project:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert(`Failed to create project: ${errorMessage}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Code"
          value={formData.project_code}
          onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
          placeholder="e.g., PROJ-001"
          required
        />
        
        <Input
          label="Project Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Solution Architect <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsArchitectOpen(!isArchitectOpen)}
              className="w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md focus:outline-none focus:border-blue-500 transition-all duration-200 flex items-center justify-between group"
            >
              <span className="text-gray-900">
                {architects.find(a => a.id === formData.solution_architect_id)?.full_name || 'Select an architect'}
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isArchitectOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isArchitectOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                {architects.map((architect) => (
                  <button
                    key={architect.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, solution_architect_id: architect.id });
                      setIsArchitectOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                      formData.solution_architect_id === architect.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    {architect.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!formData.solution_architect_id && (
            <input
              type="text"
              required
              className="absolute opacity-0 pointer-events-none"
              value={formData.solution_architect_id}
              onChange={() => {}}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />
          
          <Input
            label="End Date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>

        {/* File Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments
          </label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = Array.from(e.dataTransfer.files);
              setAttachments(prev => [...prev, ...files]);
            }}
          >
            <input
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const files = Array.from(e.target.files);
                  setAttachments(prev => [...prev, ...files]);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
              </p>
              <p className="mt-1 text-xs text-gray-500">Any file type supported</p>
            </div>
          </div>
          
          {/* File List */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <svg
                      className="h-5 w-5 text-gray-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                    className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create Project</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditProjectModal({
  isOpen,
  onClose,
  project,
  onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onUpdate: () => void;
}) {
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description,
    status: project.status,
    progress: project.progress,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectAPI.update(project.id, formData);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Show existing attachments */}
        {Array.isArray(project.attachments) && project.attachments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Existing Attachments
            </label>
            <div className="space-y-2">
              {project.attachments.map((attachment: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-gray-900">{attachment.filename}</span>
                  </div>
                  <a
                    href={`https://resource-manager-kg4d.onrender.com/${attachment.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <Input
          label="Project Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <Input
          type="number"
          label="Progress (%)"
          value={formData.progress}
          onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
          min="0"
          max="100"
          required
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Update Project</Button>
        </div>
      </form>
    </Modal>
  );
}

function BookingModal({
  isOpen,
  onClose,
  project,
  onBook,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onBook: () => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [bookingData, setBookingData] = useState({
    hours: 0,
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      // Set default dates to today and one month from today
      const today = new Date();
      const oneMonthLater = new Date(today);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      
      setBookingData({
        hours: 0,
        startDate: today.toISOString().split('T')[0],
        endDate: oneMonthLater.toISOString().split('T')[0],
      });
    }
  }, [isOpen]);

  const loadEmployees = async () => {
    try {
      const data = await employeeAPI.getAll();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) return 0;
    
    let workingDays = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Count weekdays (Monday = 1 to Friday = 5)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  };

  const workingDays = calculateWorkingDays(bookingData.startDate, bookingData.endDate);
  const maxHours = workingDays * 6; // 6 hours per working day

  const handleBooking = async () => {
    if (!selectedEmployee || !bookingData.startDate || !bookingData.endDate || bookingData.hours <= 0) {
      alert('Please select an employee, date range, and enter valid hours');
      return;
    }

    if (new Date(bookingData.endDate) < new Date(bookingData.startDate)) {
      alert('End date must be after or equal to start date');
      return;
    }

    if (bookingData.hours > maxHours) {
      alert(`Cannot book ${bookingData.hours} hours. Maximum ${maxHours} hours for ${workingDays} working days (6hrs/day).`);
      return;
    }

    try {
      await projectAPI.createBooking(project.id, {
        employee_id: selectedEmployee.id,
        start_date: bookingData.startDate,
        end_date: bookingData.endDate,
        booked_hours: bookingData.hours,
      });
      onBook();
      onClose();
      setSelectedEmployee(null);
      setBookingData({ hours: 0, startDate: '', endDate: '' });
    } catch (error: any) {
      console.error('Error creating booking:', error);
      const errorMessage = error?.message || 'Failed to create booking. Please try again.';
      alert(errorMessage);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Book Resources - ${project.name}`} size="xl">
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <Skeleton className="mb-3 h-5 w-40" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="mb-3 h-5 w-32" />
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Employee Selection */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Select Team Member</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => setSelectedEmployee(employee)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedEmployee?.id === employee.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{employee.full_name}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {employee.position} • {employee.department}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Booking Details */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Booking Details</h4>
            
            {selectedEmployee ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-900">
                    Selected: {selectedEmployee.full_name}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {selectedEmployee.position} • {selectedEmployee.department}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.startDate}
                    onChange={(e) => setBookingData({ ...bookingData, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.endDate}
                    onChange={(e) => setBookingData({ ...bookingData, endDate: e.target.value })}
                    min={bookingData.startDate}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                </div>

                {workingDays > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-sm text-blue-900">
                      📅 {workingDays} working days ({new Date(bookingData.startDate).toLocaleDateString()} - {new Date(bookingData.endDate).toLocaleDateString()})
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      Maximum: {maxHours} hours (6 hrs/day)
                    </div>
                  </div>
                )}

                <Input
                  type="number"
                  label="Hours to Book"
                  value={bookingData.hours}
                  onChange={(e) => setBookingData({ ...bookingData, hours: parseInt(e.target.value) || 0 })}
                  min="0"
                  max={maxHours}
                />

                {bookingData.hours > 0 && workingDays > 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="text-sm text-green-900">
                      Average: {(bookingData.hours / workingDays).toFixed(1)} hrs/day
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      Remaining capacity: {maxHours - bookingData.hours} hours
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleBooking}>
                    Confirm Booking
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <div className="text-sm text-gray-600">
                  Select a team member to book resources
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </Modal>
  );
}
function ProjectDetailsModal({
  isOpen,
  onClose,
  project,
  bookings,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  bookings: Booking[];
}) {
  // Group bookings by employee
  const employeeBookings = bookings.reduce((acc, booking) => {
    const key = booking.employee_id;
    if (!acc[key]) {
      acc[key] = {
        employee_name: booking.full_name,
        employee_id: booking.employee_id || 'N/A',
        department: booking.department,
        total_hours: 0,
        bookings: [],
      };
    }
    acc[key].total_hours += booking.booked_hours;
    acc[key].bookings.push(booking);
    return acc;
  }, {} as Record<number, any>);

  const employees = Object.values(employeeBookings);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project.name} size="lg">
      <div className="space-y-6">
        {/* Project Info */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
            <p className="text-sm text-gray-600">{project.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Status</h3>
              <span className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                {project.status}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Progress</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        {Array.isArray(project.attachments) && project.attachments.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h3>
            <div className="space-y-2">
              {project.attachments.map((attachment: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(attachment.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://resource-manager-kg4d.onrender.com/${attachment.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Members Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
          {employees.length > 0 ? (
            <div className="space-y-3">
              {employees.map((emp) => (
                <Card key={emp.employee_id} className="border-l-4 border-l-blue-500">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                            {emp.employee_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{emp.employee_name}</h4>
                            <p className="text-xs text-gray-500">{emp.department}</p>
                          </div>
                        </div>
                        
                        {/* Booking details */}
                        <div className="mt-3 space-y-1">
                          {emp.bookings.map((booking: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                              <span className="text-gray-600">
                                {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                              </span>
                              <span className="font-medium text-gray-900">{booking.booked_hours} hours</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="ml-4 text-right">
                        <div className="text-xs text-gray-500">Total Hours</div>
                        <div className="text-2xl font-bold text-blue-600">{emp.total_hours}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">No team members assigned yet</p>
              <p className="mt-1 text-xs text-gray-500">Book resources to add team members to this project</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}