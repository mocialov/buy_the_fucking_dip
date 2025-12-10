// Simple browser console test for XLK
// Copy and paste this into your browser console when the app is open

console.log('🧪 Testing XLK data fetch...\n');

// Try to access the Supabase service
import('./src/services/supabaseService.ts').then(async (module) => {
  const { fetchStockDataFromSupabase, fetchMultipleStockDataFromSupabase, isSupabaseAvailable } = module;
  
  console.log('Supabase available:', isSupabaseAvailable());
  
  if (!isSupabaseAvailable()) {
    console.error('❌ Supabase not initialized! Check your env variables.');
    return;
  }
  
  // Test XLK specifically
  console.log('\n--- Testing XLK single fetch ---');
  const xlkData = await fetchStockDataFromSupabase('XLK');
  console.log('XLK result:', xlkData);
  console.log('XLK data points:', xlkData?.length || 0);
  
  // Test batch fetch with XLK
  console.log('\n--- Testing batch fetch with XLK ---');
  const batchResult = await fetchMultipleStockDataFromSupabase(['XLK', 'VGT', 'AAPL']);
  console.log('Batch result size:', batchResult.size);
  console.log('Has XLK:', batchResult.has('XLK'));
  console.log('XLK data:', batchResult.get('XLK')?.length || 0, 'points');
  
}).catch(error => {
  console.error('Error loading module:', error);
});
