-- Create a new table for bill documents
CREATE TABLE IF NOT EXISTS bill_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    document_url TEXT NOT NULL,
    document_type TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies for bill_documents
ALTER TABLE bill_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view bills for accessible items" ON bill_documents;
DROP POLICY IF EXISTS "Users can view all bills" ON bill_documents;
DROP POLICY IF EXISTS "Users can insert bills for their own items" ON bill_documents;
DROP POLICY IF EXISTS "Users can update their own bills" ON bill_documents;
DROP POLICY IF EXISTS "Users can delete their own bills" ON bill_documents;

-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_bill_documents_item_id;

-- Policy to allow all users to view bills
CREATE POLICY "Users can view all bills" ON bill_documents
    FOR SELECT
    USING (true);

-- Policy to allow users to insert bills for their own items
CREATE POLICY "Users can insert bills for their own items" ON bill_documents
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = bill_documents.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Policy to allow users to update their own bills
CREATE POLICY "Users can update their own bills" ON bill_documents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = bill_documents.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Policy to allow users to delete their own bills
CREATE POLICY "Users can delete their own bills" ON bill_documents
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = bill_documents.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Create an index for faster lookups
CREATE INDEX idx_bill_documents_item_id ON bill_documents(item_id); 