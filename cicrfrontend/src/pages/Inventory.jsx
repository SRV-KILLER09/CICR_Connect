import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import {
  adjustInventoryStock,
  adjustInventoryStockById,
  fetchInventory,
  issueInventoryItem,
  addInventoryItem
} from '../api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import SideDrawer from '../components/ui/SideDrawer';

const STOCK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'low', label: 'Low' },
  { id: 'healthy', label: 'Healthy' },
];

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const toDateLabel = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStockHealth = (item) => {
  const total = Math.max(Number(item?.totalQuantity || 0), 0);
  const available = Math.max(Number(item?.availableQuantity || 0), 0);
  if (available === 0 || total === 0) {
    return { id: 'critical', label: 'Critical', className: 'text-rose-400 border-red-200 bg-rose-500/10' };
  }
  const ratio = available / total;
  if (ratio <= 0.2 || available <= 3) {
    return { id: 'critical', label: 'Critical', className: 'text-rose-400 border-red-200 bg-rose-500/10' };
  }
  if (ratio <= 0.45 || available <= 8) {
    return { id: 'low', label: 'Low', className: 'text-amber-400 border-amber-200 bg-amber-500/10' };
  }
  return { id: 'healthy', label: 'Healthy', className: 'text-emerald-400 border-emerald-200 bg-emerald-500/10' };
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null); // for Issue Modal
  const [expandedItemId, setExpandedItemId] = useState('');
  const [issueData, setIssueData] = useState({ quantity: 1, project: '' });
  const [isIssuing, setIsIssuing] = useState(false);
  const [editingItemId, setEditingItemId] = useState('');
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const profileData = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profileData.result || profileData;
  const isAdmin = userData.role?.toLowerCase() === 'admin' || userData.role?.toLowerCase() === 'head';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    setIssueData((prev) => ({
      ...prev,
      quantity: Math.min(Number(prev.quantity) || 1, Math.max(selectedItem.availableQuantity || 1, 1)),
    }));
  }, [selectedItem]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await fetchInventory();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      dispatchToast('Failed to load inventory.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const totalParts = items.length;
    const unitsTotal = items.reduce((sum, row) => sum + Number(row.totalQuantity || 0), 0);
    const unitsAvailable = items.reduce((sum, row) => sum + Number(row.availableQuantity || 0), 0);
    const unitsIssued = Math.max(unitsTotal - unitsAvailable, 0);
    const attentionCount = items.filter((row) => getStockHealth(row).id !== 'healthy').length;

    return { totalParts, unitsAvailable, unitsIssued, attentionCount };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const rows = items.filter((item) => {
      const matchesSearch =
        !normalized ||
        String(item.itemName || '').toLowerCase().includes(normalized) ||
        String(item.category || '').toLowerCase().includes(normalized) ||
        String(item.location || '').toLowerCase().includes(normalized);
      if (!matchesSearch) return false;
      if (stockFilter === 'all') return true;
      return getStockHealth(item).id === stockFilter;
    });

    return [...rows].sort((a, b) => {
      const healthRank = { critical: 0, low: 1, healthy: 2 };
      const aRank = healthRank[getStockHealth(a).id] ?? 3;
      const bRank = healthRank[getStockHealth(b).id] ?? 3;
      if (aRank !== bRank) return aRank - bRank;
      return String(a.itemName || '').localeCompare(String(b.itemName || ''));
    });
  }, [items, searchTerm, stockFilter]);

  const openIssue = (item) => {
    setSelectedItem(item);
    setIssueData({ quantity: 1, project: '' });
  };

  const openEdit = (itemId) => {
    setExpandedItemId(itemId);
    setEditingItemId(itemId);
    setAdjustMode('add');
    setAdjustQty(1);
  };

  const closeEdit = () => {
    setEditingItemId('');
    setAdjustQty(1);
  };

  const submitAdjust = async (itemId) => {
    setAdjusting(true);
    try {
      const payload = { itemId, mode: adjustMode, quantity: Number(adjustQty) };
      try {
        await adjustInventoryStock(payload);
      } catch {
        await adjustInventoryStockById(itemId, { mode: adjustMode, quantity: Number(adjustQty) });
      }
      await loadData();
      closeEdit();
      dispatchToast('Stock updated successfully.', 'success');
    } catch (err) {
      dispatchToast('Failed to adjust stock', 'error');
    } finally {
      setAdjusting(false);
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsIssuing(true);
    try {
      await issueInventoryItem({
        itemId: selectedItem._id,
        quantity: Number(issueData.quantity),
        project: issueData.project,
      });
      setSelectedItem(null);
      setIssueData({ quantity: 1, project: '' });
      await loadData();
      dispatchToast('Inventory issued successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to issue item.', 'error');
    } finally {
      setIsIssuing(false);
    }
  };
  
  const handleAddItemSubmit = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    const formData = new FormData(e.target);
    const payload = {
      itemName: formData.get('itemName'),
      category: formData.get('category'),
      location: formData.get('location'),
      totalQuantity: Number(formData.get('quantity')),
    };
    
    try {
      await addInventoryItem(payload);
      dispatchToast('Item added successfully.', 'success');
      setIsAddDrawerOpen(false);
      loadData();
    } catch {
      dispatchToast('Failed to add item.', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={42} />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl pb-20 px-4 sm:px-6 lg:px-8 space-y-8 pb-20">
      <header>
        <PageHeader
          eyebrow="Inventory Operations"
          title="Lab Inventory"
          subtitle="Operational stock board for parts, issue records, and adjustment history."
          icon={Database}
          actions={
            isAdmin && (
              <button onClick={() => setIsAddDrawerOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">
                <Plus size={14} /> Add Part
              </button>
            )
          }
        />
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Parts" value={metrics.totalParts} tone="slate" />
        <Metric label="Available" value={metrics.unitsAvailable} tone="emerald" />
        <Metric label="Issued" value={metrics.unitsIssued} tone="blue" />
        <Metric label="Needs Attention" value={metrics.attentionCount} tone="amber" />
      </section>

      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 rounded-2xl sticky top-20 z-20 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full lg:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parts, category, location..."
            className="input-field pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STOCK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStockFilter(filter.id)}
              className={`btn !w-auto !px-3 !py-2 ${
                stockFilter === filter.id ? 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2' : 'px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        {filteredItems.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-600">No inventory items match the filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredItems.map((item, idx) => {
              const health = getStockHealth(item);
              const available = Math.max(Number(item.availableQuantity || 0), 0);
              const total = Math.max(Number(item.totalQuantity || 0), 0);
              const ratio = total > 0 ? Math.min((available / total) * 100, 100) : 0;
              const isExpanded = expandedItemId === item._id;

              return (
                <motion.article
                  key={item._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.025 }}
                  className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 mb-1">{item.itemName}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{item.category || 'General'}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${health.className}`}>{health.label}</span>
                        </div>
                      </div>
                      <button onClick={() => setExpandedItemId(isExpanded ? '' : item._id)} className="text-slate-600 hover:text-slate-900 p-1">
                        {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    </div>

                    <div className="space-y-4 my-4">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span className="text-slate-600 flex items-center gap-1"><Box size={14} className="text-blue-600"/> {available} / {total} Available</span>
                        <span className="text-slate-600 flex items-center gap-1"><MapPin size={14} className="text-accent-pink"/> {item.location || 'Lab'}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${ratio}%` }}
                          className={`h-full ${health.id === 'critical' ? 'bg-accent-pink' : health.id === 'low' ? 'bg-amber-400' : 'bg-accent-emerald'}`}
                        />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between gap-2">
                            <button onClick={() => openIssue(item)} disabled={available === 0} className={`btn flex-1 ${available > 0 ? 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2' : 'px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 opacity-50'}`}>Issue Item</button>
                            {isAdmin && (
                              <button onClick={() => openEdit(item._id)} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 flex-1">Adjust Stock</button>
                            )}
                          </div>
                          
                          {/* Stock Edit Inline */}
                          {editingItemId === item._id && isAdmin && (
                            <form onSubmit={(e) => { e.preventDefault(); submitAdjust(item._id); }} className="mt-4 p-3 bg-slate-100 rounded-xl space-y-3">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setAdjustMode('subtract')} className={`btn flex-1 ${adjustMode === 'subtract' ? 'bg-accent-pink text-slate-900' : 'px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2'}`}><Minus size={14}/></button>
                                <button type="button" onClick={() => setAdjustMode('add')} className={`btn flex-1 ${adjustMode === 'add' ? 'bg-accent-blue text-slate-900' : 'px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2'}`}><Plus size={14}/></button>
                              </div>
                              <input type="number" min="1" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="input-field text-center" />
                              <div className="flex gap-2">
                                <button type="button" onClick={closeEdit} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 flex-1">Cancel</button>
                                <button type="submit" disabled={adjusting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 flex-1">Save</button>
                              </div>
                            </form>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={`Issue ${selectedItem?.itemName}`}>
        <form onSubmit={handleIssueSubmit} className="space-y-4">
          <p className="text-sm text-slate-600 mb-4">You are issuing items from the lab inventory. They must be tracked.</p>
          
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Quantity (Max: {selectedItem?.availableQuantity})</label>
            <input type="number" min="1" max={selectedItem?.availableQuantity} value={issueData.quantity} onChange={(e) => setIssueData(p => ({...p, quantity: e.target.value}))} required className="input-field" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Project / Purpose</label>
            <input type="text" value={issueData.project} onChange={(e) => setIssueData(p => ({...p, project: e.target.value}))} required className="input-field" placeholder="e.g. Quadcopter build" />
          </div>
          
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={() => setSelectedItem(null)} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Cancel</button>
            <button type="submit" disabled={isIssuing} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Confirm Issue</button>
          </div>
        </form>
      </Modal>

      <SideDrawer isOpen={isAddDrawerOpen} onClose={() => setIsAddDrawerOpen(false)} title="Add New Inventory Part">
        <form onSubmit={handleAddItemSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Part Name</label>
            <input name="itemName" required className="input-field" placeholder="e.g. Arduino Uno" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Category</label>
            <input name="category" required className="input-field" placeholder="e.g. Microcontrollers" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Location</label>
            <input name="location" required className="input-field" placeholder="e.g. Shelf A2" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Initial Stock Quantity</label>
            <input name="quantity" type="number" min="1" required className="input-field" defaultValue="1" />
          </div>
          
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 mt-8">
            <button type="button" onClick={() => setIsAddDrawerOpen(false)} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Cancel</button>
            <button type="submit" disabled={addLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Save Part</button>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}

function Metric({ label, value, tone = 'slate' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'blue' ? 'text-blue-600' : tone === 'amber' ? 'text-amber-400' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 rounded-2xl border-t-2 border-slate-200" style={{ borderTopColor: tone === 'slate' ? '' : `var(--accent-${tone})` }}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-600">{label}</p>
      <p className={`text-3xl font-black mt-2 ${toneClass}`}>{value}</p>
    </div>
  );
}
