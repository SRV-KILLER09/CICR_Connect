import React, { useState } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';

// Sortable Task Item
function SortableTaskItem({ task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 mb-3 rounded-xl border ${isDragging ? 'border-indigo-500 shadow-md shadow-blue-500/20' : 'border-slate-200'} bg-slate-50 border-slate-200 text-slate-600 bg-white border border-slate-200 shadow-sm shadow-soft flex items-start gap-3 cursor-grab`}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={18} className="text-slate-500 mt-1 cursor-grab" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-[var(--text-1)]">{task.title}</h4>
        <p className="text-xs text-[var(--text-3)] mt-1 line-clamp-2">{task.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-[10px] flex items-center justify-center font-bold border-2 border-[var(--surface-2)] text-slate-900">AM</div>
          </div>
          <span className="text-[10px] font-medium px-2 py-1 bg-[var(--surface-3)] rounded-md text-[var(--text-2)]">{task.priority}</span>
        </div>
      </div>
    </div>
  );
}

// Column Component
function TaskColumn({ column, tasks }) {
  return (
    <div className="flex-1 min-w-[280px] flex flex-col ui-surface bg-white border border-slate-200 shadow-sm rounded-2xl bg-white border border-slate-200 shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-2)] flex items-center gap-2">
          {column.title}
          <span className="bg-[var(--surface-3)] text-[var(--text-3)] text-[10px] px-2 py-0.5 rounded-full">{tasks.length}</span>
        </h3>
        <button className="text-slate-500 hover:text-slate-900 transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto">
          {tasks.map((task) => (
            <SortableTaskItem key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>

      <button className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all text-sm font-medium">
        <Plus size={16} /> Add Task
      </button>
    </div>
  );
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Design Database Schema', description: 'Create models for users, tasks, and projects.', column: 'todo', priority: 'High' },
    { id: '2', title: 'Implement Auth', description: 'Setup JWT and Role Based Access Control.', column: 'in-progress', priority: 'Critical' },
    { id: '3', title: 'UI Mockups', description: 'Figma designs for dashboard and meeting rooms.', column: 'done', priority: 'Medium' },
    { id: '4', title: 'Set up CI/CD', description: 'GitHub Actions for deployment to Render.', column: 'todo', priority: 'Low' },
  ]);

  const columns = [
    { id: 'todo', title: 'To Do' },
    { id: 'in-progress', title: 'In Progress' },
    { id: 'done', title: 'Done' },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          // Reorder tasks
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-full flex flex-col"
    >
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black gradient-text-blue brand-title">Project Canvas</h2>
          <p className="text-sm text-[var(--text-3)] mt-1">Manage and track your tasks effortlessly.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center gap-2">
            <Plus size={16} /> New Sprint
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4 flex-1">
          {columns.map(col => (
            <TaskColumn 
              key={col.id} 
              column={col} 
              tasks={tasks.filter(t => t.column === col.id)} 
            />
          ))}
        </div>
      </DndContext>
    </motion.div>
  );
}
