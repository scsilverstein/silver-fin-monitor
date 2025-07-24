import React, { useState } from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { 
  X, 
  Rss, 
  Podcast, 
  Youtube, 
  Database, 
  Sparkles,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { feedsApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface AddFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FeedFormData {
  name: string;
  type: 'rss' | 'podcast' | 'youtube' | 'api' | 'reddit';
  url: string;
  categories: string[];
  priority: 'low' | 'medium' | 'high';
  updateFrequency: string;
  subreddit?: string;
  extractGuests?: boolean;
  processTranscript?: boolean;
}

const feedTypeOptions = [
  { value: 'rss', label: 'RSS Feed', icon: Rss, description: 'News articles and blog posts' },
  { value: 'podcast', label: 'Podcast', icon: Podcast, description: 'Audio content with transcription' },
  { value: 'youtube', label: 'YouTube', icon: Youtube, description: 'Video content with transcripts' },
  { value: 'api', label: 'API Feed', icon: Database, description: 'Custom API endpoint' },
  { value: 'reddit', label: 'Reddit', icon: Sparkles, description: 'Reddit posts and discussions' },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-600' },
];

const categoryOptions = [
  'finance', 'investing', 'markets', 'economy', 'technology', 'startup',
  'venture capital', 'crypto', 'politics', 'geopolitics', 'analysis',
  'news', 'trading', 'commodities', 'energy', 'real estate'
];

export const AddFeedModal: React.FC<AddFeedModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<FeedFormData>({
    name: '',
    type: 'rss',
    url: '',
    categories: [],
    priority: 'medium',
    updateFrequency: 'hourly',
    subreddit: '',
    extractGuests: false,
    processTranscript: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'rss',
      url: '',
      categories: [],
      priority: 'medium',
      updateFrequency: 'hourly',
      subreddit: '',
      extractGuests: false,
      processTranscript: false,
    });
    setErrors({});
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Feed name is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'Feed URL is required';
    } else {
      try {
        new URL(formData.url);
      } catch {
        newErrors.url = 'Please enter a valid URL';
      }
    }

    if (formData.categories.length === 0) {
      newErrors.categories = 'At least one category is required';
    }

    if (formData.type === 'reddit' && !formData.subreddit?.trim()) {
      newErrors.subreddit = 'Subreddit name is required for Reddit feeds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const config: any = {
        categories: formData.categories,
        priority: formData.priority,
        updateFrequency: formData.updateFrequency,
      };

      // Add type-specific configuration
      if (formData.type === 'reddit') {
        config.subreddit = formData.subreddit;
        config.sort = 'hot';
        config.limit = 25;
        config.minScore = 5;
        config.minComments = 2;
        config.excludeNSFW = true;
      }

      if (formData.type === 'podcast') {
        config.extractGuests = formData.extractGuests;
        config.processTranscript = formData.processTranscript;
      }

      // Temporary workaround: use 'api' type for reddit feeds
      const feedType = formData.type === 'reddit' ? 'api' : formData.type;
      
      // If it's a reddit feed, mark it in the config
      if (formData.type === 'reddit') {
        config.feedSubtype = 'reddit';
      }
      
      await feedsApi.create({
        name: formData.name,
        type: feedType,
        url: formData.url,
        config,
      });

      toast.success('Feed added successfully!');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Failed to create feed:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      // Log axios-specific error details
      if (error.response) {
        console.error('Error response details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            data: error.config?.data,
            headers: error.config?.headers
          }
        });
      }
      
      // Handle different types of errors
      let errorMessage = 'Failed to create feed';
      
      if (error.name === 'NetworkError') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again or check server logs.';
      } else if (error.response?.status === 409) {
        errorMessage = 'A feed with this URL already exists.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Add New Feed
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Feed Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Feed Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter feed name"
            />
            {errors.name && (
              <div className="flex items-center mt-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.name}
              </div>
            )}
          </div>

          {/* Feed Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Feed Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {feedTypeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = formData.type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: option.value as any })}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center mb-1">
                      <Icon className="h-4 w-4 mr-2" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feed URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Feed URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder={
                formData.type === 'reddit' 
                  ? 'https://www.reddit.com/r/investing.json'
                  : formData.type === 'podcast'
                  ? 'https://feeds.megaphone.fm/example'
                  : 'https://example.com/feed.xml'
              }
            />
            {errors.url && (
              <div className="flex items-center mt-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.url}
              </div>
            )}
          </div>

          {/* Reddit-specific: Subreddit */}
          {formData.type === 'reddit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subreddit Name
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                  r/
                </span>
                <input
                  type="text"
                  value={formData.subreddit}
                  onChange={(e) => setFormData({ ...formData, subreddit: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="investing"
                />
              </div>
              {errors.subreddit && (
                <div className="flex items-center mt-1 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.subreddit}
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => {
                const isSelected = formData.categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryToggle(category)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                    {category}
                  </button>
                );
              })}
            </div>
            {errors.categories && (
              <div className="flex items-center mt-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.categories}
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <div className="flex gap-3">
              {priorityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: option.value as any })}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    formData.priority === option.value
                      ? `${option.color} border-2 border-current`
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Update Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Update Frequency
            </label>
            <select
              value={formData.updateFrequency}
              onChange={(e) => setFormData({ ...formData, updateFrequency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="15min">Every 15 minutes</option>
              <option value="30min">Every 30 minutes</option>
              <option value="hourly">Hourly</option>
              <option value="4hours">Every 4 hours</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {/* Podcast-specific options */}
          {formData.type === 'podcast' && (
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="extractGuests"
                  checked={formData.extractGuests}
                  onChange={(e) => setFormData({ ...formData, extractGuests: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="extractGuests" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Extract guest names from episodes
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="processTranscript"
                  checked={formData.processTranscript}
                  onChange={(e) => setFormData({ ...formData, processTranscript: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="processTranscript" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Process audio transcripts (requires Whisper)
                </label>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <ModernButton
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </ModernButton>
            <ModernButton
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </div>
              ) : (
                'Add Feed'
              )}
            </ModernButton>
          </div>
        </form>
      </div>
    </div>
  );
};