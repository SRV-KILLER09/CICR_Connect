import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, GripVertical, Settings2, Save } from 'lucide-react';

export default function RecruitmentFormBuilder({ onSave, onCancel }) {
  const [drive, setDrive] = useState({
    title: '',
    description: '',
    positions: '',
    eligibleYears: [1, 2, 3, 4],
    deadline: '',
    isOpen: true,
  });

  const [schema, setSchema] = useState([]);

  const addField = (type) => {
    setSchema([...schema, {
      id: `field_${Date.now()}`,
      label: 'New Question',
      type,
      options: type === 'select' || type === 'multiselect' || type === 'radio' ? ['Option 1'] : [],
      required: false
    }]);
  };

  const updateField = (index, updates) => {
    const newSchema = [...schema];
    newSchema[index] = { ...newSchema[index], ...updates };
    setSchema(newSchema);
  };

  const removeField = (index) => {
    setSchema(schema.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!drive.title || !drive.deadline) return;
    
    onSave({
      ...drive,
      positions: drive.positions.split(',').map(p => p.trim()).filter(Boolean),
      formSchema: schema
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
        <div className="p-6 md:p-8 space-y-6 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Drive Configuration</h3>
            <p className="text-sm text-slate-500">Set the basic parameters for this recruitment drive.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Drive Title <span className="text-red-500">*</span></label>
              <input required value={drive.title} onChange={e => setDrive({...drive, title: e.target.value})} type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm" placeholder="e.g. Winter 2026 Developer Intake" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Application Deadline <span className="text-red-500">*</span></label>
              <input required value={drive.deadline} onChange={e => setDrive({...drive, deadline: e.target.value})} type="datetime-local" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Description</label>
              <textarea value={drive.description} onChange={e => setDrive({...drive, description: e.target.value})} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm" placeholder="Details about this drive..."></textarea>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Positions Available (comma separated)</label>
              <input value={drive.positions} onChange={e => setDrive({...drive, positions: e.target.value})} type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm" placeholder="e.g. Frontend, Backend, UI/UX" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Eligible Years</label>
              <div className="flex gap-3 items-center h-10">
                {[1, 2, 3, 4, 5, 6].map(y => (
                  <label key={y} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={drive.eligibleYears.includes(y)} onChange={(e) => {
                      if (e.target.checked) setDrive({...drive, eligibleYears: [...drive.eligibleYears, y]});
                      else setDrive({...drive, eligibleYears: drive.eligibleYears.filter(year => year !== y)});
                    }} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                    {y}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Custom Form Builder</h3>
              <p className="text-sm text-slate-500">Design the application form. Basic info (Name, Email, Phone, College) is collected automatically.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => addField('text')} className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">+ Text</button>
              <button type="button" onClick={() => addField('textarea')} className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">+ Long Text</button>
              <button type="button" onClick={() => addField('select')} className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">+ Dropdown</button>
            </div>
          </div>

          <div className="space-y-4">
            {schema.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm">
                No custom fields added. The default application form will be used.
              </div>
            ) : (
              schema.map((field, index) => (
                <div key={field.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm group relative flex gap-4 items-start">
                  <div className="text-slate-400 mt-2 cursor-grab"><GripVertical size={20} /></div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <input 
                        type="text" 
                        value={field.label} 
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        className="w-full text-sm font-semibold bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:ring-0 px-0 py-1"
                      />
                    </div>
                    {['select', 'multiselect', 'radio'].includes(field.type) && (
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Options (comma separated)</label>
                        <input 
                          type="text" 
                          value={field.options.join(', ')} 
                          onChange={(e) => updateField(index, { options: e.target.value.split(',').map(s => s.trim()) })}
                          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 md:col-span-2 pt-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                        <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                        Required Field
                      </label>
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md ml-auto uppercase tracking-wide font-bold">{field.type}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeField(index)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18} /></button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50">Cancel</button>
          <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 flex items-center gap-2">
            <Save size={16} /> Publish Drive
          </button>
        </div>
      </form>
    </div>
  );
}
