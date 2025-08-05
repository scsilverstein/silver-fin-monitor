import React from 'react';
import { WorkerControls } from '@/components/queue/WorkerControls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const QueueTest: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Queue Management Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is a test page to verify the queue management components are working.</p>
          <p>If you can see this page, the routing is working correctly.</p>
        </CardContent>
      </Card>
      
      <WorkerControls />
      
      <Card>
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Current URL: {window.location.href}</p>
          <p>Current time: {new Date().toLocaleString()}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueueTest;