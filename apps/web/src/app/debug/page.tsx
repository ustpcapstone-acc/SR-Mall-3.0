"use client";

import React, { useEffect, useState } from "react";
import { debugDatabaseAction } from "@/app/actions/debug";

export default function DebugPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testDatabase = async () => {
    setLoading(true);
    try {
      const res = await debugDatabaseAction();
      setResult(res);
    } catch (error) {
      setResult({ success: false, error: "Failed to run debug action" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Database Debug</h1>

        <button
          onClick={testDatabase}
          disabled={loading}
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Testing..." : "Test Database Connection"}
        </button>

        {result && (
          <div className="mt-8 p-6 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Result:</h2>
            <pre className="text-sm overflow-auto bg-zinc-200 dark:bg-zinc-800 p-4 rounded-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
