import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit3, Trash2, BookOpen } from 'lucide-react';
import { loadSeries, createSeries, deleteSeries } from '@/lib/portalServer';
import { toast } from 'sonner';

export default function SeriesDashboard({ onSelectSeries, onEditSeries, onBack }) {
  const [series, setSeries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadSeriesData();
  }, []);

  const loadSeriesData = async () => {
    setIsLoading(true);
    try {
      const data = await loadSeries();
      setSeries(data);
    } catch (err) {
      toast.error('Failed to load series');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSeries = async () => {
    if (!newTitle.trim()) {
      toast.error('Series name is required');
      return;
    }

    setIsCreating(true);
    try {
      const newSeries = await createSeries(newTitle, newDescription);
      if (newSeries) {
        setSeries([newSeries, ...series]);
        setNewTitle('');
        setNewDescription('');
        setShowCreateForm(false);
        toast.success('Series created');
        onSelectSeries(newSeries);
      }
    } catch (err) {
      toast.error('Failed to create series');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSeries = async (id) => {
    if (!window.confirm('Delete this series? All tests will be removed.')) return;

    try {
      await deleteSeries(id);
      setSeries(series.filter(s => s.id !== id));
      toast.success('Series deleted');
    } catch (err) {
      toast.error('Failed to delete series');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Test Series</h2>
          <p className="text-muted-foreground text-sm">Manage your test series and create new ones</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} size="lg">
          <Plus size={20} className="mr-2" />
          New Series
        </Button>
      </div>

      {showCreateForm && (
        <Card className="border border-border bg-secondary/5 dark:bg-secondary/10 dark:border-secondary/20">
          <CardHeader>
            <CardTitle>Create New Series</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Series Name *</label>
              <Input
                placeholder="e.g., JEE Advanced Full Length"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                placeholder="Describe this test series..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateSeries}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading series...</div>
      ) : series.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/60 mb-2" />
          <p className="text-muted-foreground">No series yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map((s) => (
            <Card 
              key={s.id}
              className="hover:shadow-lg transition cursor-pointer"
              onClick={() => onSelectSeries(s)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{s.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{s.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={s.published ? 'default' : 'secondary'}>
                      {s.published ? 'Published' : 'Draft'}
                    </Badge>
                    <Badge variant="secondary">{s.testCount ?? 0} tests</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                )}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSeries?.(s);
                    }}
                  >
                    <Edit3 size={16} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSeries(s.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
