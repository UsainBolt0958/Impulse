import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save } from 'lucide-react';
import { updateSeries } from '@/lib/portalServer';
import { toast } from 'sonner';
import ImageUploadField from './ImageUploadField';

export default function SeriesEditor({ series, onBack, onTestsClick, onSave }) {
  const [formData, setFormData] = useState({
    title: series?.title || '',
    description: series?.description || '',
    examLabel: series?.examLabel || '',
    durationMinutes: series?.durationMinutes || 180,
    backgroundImage: series?.backgroundImage || '',
    published: series?.published || false,
    publish_at: series?.publish_at || null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const saveBackgroundImage = async (backgroundImage) => {
    setFormData((current) => ({ ...current, backgroundImage }));
    if (!series?.id) return;

    try {
      const updated = await updateSeries(series.id, { backgroundImage });
      if (updated) {
        onSave?.(updated);
        toast.success(backgroundImage ? 'Background image saved' : 'Background image removed');
      }
    } catch (err) {
      toast.error('Failed to save background image');
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Series name required');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateSeries(series.id, {
        ...formData,
        published: formData.published,
        publish_at: formData.publish_at,
      });
      toast.success('Series saved');
      if (updated) {
        onSave?.(updated);
        setFormData((current) => ({ ...current, published: updated.published ?? current.published, publish_at: updated.publish_at ?? current.publish_at }));
      }
    } catch (err) {
      toast.error('Failed to save series');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!series?.id) {
      toast.error('Save the series before publishing.');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Series name required');
      return;
    }

    setIsPublishing(true);
    try {
      const updated = await updateSeries(series.id, {
        ...formData,
        published: true,
        publish_at: new Date().toISOString(),
      });
      toast.success('Series published');
      if (updated) {
        onSave?.(updated);
        setFormData((current) => ({ ...current, published: true, publish_at: updated.publish_at }));
      }
    } catch (err) {
      toast.error('Failed to publish series');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Edit Series</h2>
            <p className="text-gray-600 text-sm">{series?.title}</p>
            <p className="text-xs font-black uppercase tracking-[0.2em] mt-1 text-muted-foreground">
              {formData.published ? 'Published' : 'Draft'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save size={20} className="mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {series?.id && !formData.published ? (
            <Button onClick={handlePublish} disabled={isPublishing}>
              <Save size={20} className="mr-2" />
              {isPublishing ? 'Publishing...' : 'Publish'}
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        {/* BASIC INFO TAB */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Series Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Series Name *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., JEE Advanced Full Length"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this series..."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Exam Label</label>
                <Input
                  value={formData.examLabel}
                  onChange={(e) => setFormData({ ...formData, examLabel: e.target.value })}
                  placeholder="e.g., JEE Advanced, NEET"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                <Input
                  type="number"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
              <ImageUploadField
                label="Dashboard Background Image"
                currentImageUrl={formData.backgroundImage}
                onUpload={saveBackgroundImage}
                onDelete={() => saveBackgroundImage('')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TESTS TAB */}
        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <CardTitle>Manage Tests</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <p className="text-gray-600 mb-4">Manage tests for this series</p>
              <Button onClick={onTestsClick}>Go to Tests Management</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
