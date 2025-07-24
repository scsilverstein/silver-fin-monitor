import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { 
  Building, User, TrendingUp, DollarSign, MapPin, 
  Shuffle, Zap, Package, Tag, Rss, Mic, PlayCircle, 
  Code, Layers, MessageCircle, Globe, ExternalLink,
  Calendar, Clock, FileText, BarChart3
} from 'lucide-react';
import { useSmartNavigation, createNavigationShortcuts } from '@/utils/navigation';

// Icon mapping
const ENTITY_ICONS = {
  company: Building,
  person: User,
  ticker: TrendingUp,
  currency: DollarSign,
  location: MapPin,
  exchange: Shuffle,
  crypto: Zap,
  commodity: Package,
  default: Tag
};

const SOURCE_ICONS = {
  rss: Rss,
  podcast: Mic,
  youtube: PlayCircle,
  api: Code,
  multi_source: Layers,
  reddit: MessageCircle,
  default: Globe
};

interface EntityLinkProps {
  entity: string | { name: string; type?: string };
  showIcon?: boolean;
  showType?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  linkTo?: 'content' | 'analytics'; // New prop to control destination
}

export const EntityLink: React.FC<EntityLinkProps> = ({ 
  entity, 
  showIcon = true, 
  showType = true,
  className = '',
  size = 'sm',
  linkTo = 'content'
}) => {
  const shortcuts = createNavigationShortcuts();
  const entityName = typeof entity === 'string' ? entity : entity.name;
  const entityType = typeof entity === 'object' ? entity.type : undefined;
  
  const IconComponent = ENTITY_ICONS[entityType as keyof typeof ENTITY_ICONS] || ENTITY_ICONS.default;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const handleClick = () => {
    if (linkTo === 'analytics') {
      // Navigate to entities page with entity parameter
      window.location.href = `/entities?entity=${encodeURIComponent(entityName)}`;
    } else {
      shortcuts.goToContentByEntity(entityName, 'entity-link');
    }
  };

  const colorClasses = linkTo === 'analytics' 
    ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800 border-purple-200 hover:border-purple-300'
    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border-blue-200 hover:border-blue-300';

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1 rounded-full 
        ${colorClasses}
        transition-colors cursor-pointer
        ${sizeClasses[size]} ${className}
      `}
      title={linkTo === 'analytics' ? `View ${entityName} analytics` : `View ${entityName} content`}
    >
      {showIcon && <IconComponent className="w-3 h-3" />}
      <span className="font-medium">{entityName}</span>
      {showType && entityType && (
        <Badge variant="secondary" className="text-xs ml-1">
          {entityType}
        </Badge>
      )}
      {linkTo === 'analytics' && (
        <BarChart3 className="w-3 h-3 ml-1" />
      )}
    </button>
  );
};

interface TopicLinkProps {
  topic: string;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TopicLink: React.FC<TopicLinkProps> = ({ 
  topic, 
  showIcon = true, 
  className = '',
  size = 'sm'
}) => {
  const shortcuts = createNavigationShortcuts();
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <button
      onClick={() => shortcuts.goToContentByTopic(topic, 'topic-link')}
      className={`
        inline-flex items-center gap-1 rounded-full 
        bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-800
        border border-green-200 hover:border-green-300
        transition-colors cursor-pointer
        ${sizeClasses[size]} ${className}
      `}
    >
      {showIcon && <Tag className="w-3 h-3" />}
      <span className="font-medium">{topic}</span>
    </button>
  );
};

interface SourceLinkProps {
  sourceId: string;
  sourceName: string;
  sourceType?: string;
  showIcon?: boolean;
  showType?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SourceLink: React.FC<SourceLinkProps> = ({ 
  sourceId,
  sourceName,
  sourceType,
  showIcon = true,
  showType = true,
  className = '',
  size = 'sm'
}) => {
  const shortcuts = createNavigationShortcuts();
  const IconComponent = SOURCE_ICONS[sourceType as keyof typeof SOURCE_ICONS] || SOURCE_ICONS.default;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <button
      onClick={() => shortcuts.goToContentBySource(sourceId, sourceName, 'source-link')}
      className={`
        inline-flex items-center gap-1 rounded-full 
        bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800
        border border-purple-200 hover:border-purple-300
        transition-colors cursor-pointer
        ${sizeClasses[size]} ${className}
      `}
    >
      {showIcon && <IconComponent className="w-3 h-3" />}
      <span className="font-medium truncate max-w-32">{sourceName}</span>
      {showType && sourceType && (
        <Badge variant="secondary" className="text-xs ml-1">
          {sourceType}
        </Badge>
      )}
    </button>
  );
};

interface DateLinkProps {
  date: string | Date;
  linkTo: 'analysis' | 'content' | 'predictions';
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DateLink: React.FC<DateLinkProps> = ({ 
  date,
  linkTo,
  showIcon = true,
  className = '',
  size = 'sm'
}) => {
  const shortcuts = createNavigationShortcuts();
  const { navigateWithFilters } = useSmartNavigation();
  
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const displayDate = new Date(dateStr).toLocaleDateString();
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const handleClick = () => {
    switch (linkTo) {
      case 'analysis':
        navigateWithFilters('/analysis', { dateFrom: dateStr, dateTo: dateStr });
        break;
      case 'content':
        navigateWithFilters('/content', { dateFrom: dateStr, dateTo: dateStr });
        break;
      case 'predictions':
        navigateWithFilters('/predictions', { dateFrom: dateStr, dateTo: dateStr });
        break;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1 rounded-full 
        bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-800
        border border-orange-200 hover:border-orange-300
        transition-colors cursor-pointer
        ${sizeClasses[size]} ${className}
      `}
    >
      {showIcon && <Calendar className="w-3 h-3" />}
      <span className="font-medium">{displayDate}</span>
    </button>
  );
};

interface AnalysisLinkProps {
  analysisId: string;
  analysisDate?: string;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AnalysisLink: React.FC<AnalysisLinkProps> = ({ 
  analysisId,
  analysisDate,
  showIcon = true,
  className = '',
  size = 'sm'
}) => {
  const shortcuts = createNavigationShortcuts();
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const displayText = analysisDate 
    ? new Date(analysisDate).toLocaleDateString()
    : analysisId.slice(0, 8);

  return (
    <button
      onClick={() => shortcuts.goToPredictionsFromAnalysis(analysisId, analysisDate)}
      className={`
        inline-flex items-center gap-1 rounded-full 
        bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800
        border border-indigo-200 hover:border-indigo-300
        transition-colors cursor-pointer
        ${sizeClasses[size]} ${className}
      `}
    >
      {showIcon && <BarChart3 className="w-3 h-3" />}
      <span className="font-medium">Analysis: {displayText}</span>
    </button>
  );
};

interface QueueJobLinkProps {
  jobId: string;
  jobType?: string;
  payload?: Record<string, any>;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const QueueJobLink: React.FC<QueueJobLinkProps> = ({ 
  jobId,
  jobType,
  payload,
  showIcon = true,
  className = '',
  size = 'sm'
}) => {
  const { navigateWithFilters } = useSmartNavigation();
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  // Extract source info from payload if available
  const sourceId = payload?.sourceId || payload?.feedId;
  const sourceName = payload?.sourceName || payload?.feedName;

  const handleClick = () => {
    const filters: any = {};
    if (sourceId) filters.sourceId = sourceId;
    if (sourceName) filters.sourceName = sourceName;
    if (jobType) filters.jobType = jobType;
    
    navigateWithFilters('/queue', filters);
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1 rounded-full 
        bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-800
        border border-gray-200 hover:border-gray-300
        transition-colors cursor-pointer
        ${sizeClasses[size]} ${className}
      `}
    >
      {showIcon && <Clock className="w-3 h-3" />}
      <span className="font-medium">Job: {jobId.slice(0, 8)}</span>
      {jobType && (
        <Badge variant="secondary" className="text-xs ml-1">
          {jobType}
        </Badge>
      )}
    </button>
  );
};

// Quick action links
interface QuickLinksProps {
  sourceId?: string;
  sourceName?: string;
  entity?: string;
  topic?: string;
  analysisId?: string;
  className?: string;
}

export const QuickLinks: React.FC<QuickLinksProps> = ({
  sourceId,
  sourceName,
  entity,
  topic,
  analysisId,
  className = ''
}) => {
  const shortcuts = createNavigationShortcuts();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-muted-foreground">Quick Links:</span>
      
      {sourceId && (
        <button
          onClick={() => shortcuts.goToQueueBySource(sourceId, sourceName)}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          View Jobs
        </button>
      )}
      
      {entity && (
        <button
          onClick={() => shortcuts.goToContentByEntity(entity)}
          className="text-xs text-green-600 hover:text-green-800 underline"
        >
          Related Content
        </button>
      )}
      
      {topic && (
        <button
          onClick={() => shortcuts.goToContentByTopic(topic)}
          className="text-xs text-purple-600 hover:text-purple-800 underline"
        >
          Topic Content
        </button>
      )}
      
      {analysisId && (
        <button
          onClick={() => shortcuts.goToPredictionsFromAnalysis(analysisId)}
          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
        >
          View Predictions
        </button>
      )}
    </div>
  );
};