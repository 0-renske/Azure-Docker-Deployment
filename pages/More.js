
export default function More() {
  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-blue-700">Our Mission</h4>
          <p className="text-gray-600">
            Group66 aims to democratize vector database technology, making it accessible and secure for businesses of all sizes. 
            Our solutions allow you to maintain ownership of your data while benefiting from cutting-edge AI capabilities.
          </p>
        </div>
        
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-blue-700">Technology</h4>
          <p className="text-gray-600">
            Built on state-of-the-art vector search algorithms, our platform seamlessly integrates with popular LLMs and embedding models. 
            We support multiple vector similarity metrics and optimized indexing for lightning-fast retrieval.
          </p>
        </div>
        
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-blue-700">Security First</h4>
          <p className="text-gray-600">
            Security is our priority. All data is encrypted at rest and in transit. 
            Our infrastructure is designed with enterprise-grade security, ensuring your proprietary LLMs and data remain protected.
          </p>
        </div>
        
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-blue-700">Customer Support</h4>
          <p className="text-gray-600">
            Our dedicated team of experts is available to help you implement and optimize your vector database solution. 
            From initial setup to ongoing maintenance, we're here to ensure your success.
          </p>
        </div>
        
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-blue-700">Scalable Solutions</h4>
          <p className="text-gray-600">
            Whether you're a startup or enterprise, our solutions scale with your needs. 
            Start small and grow your vector database infrastructure as your requirements evolve.
          </p>
        </div>
        
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-blue-700">Get Started Today</h4>
          <p className="text-gray-600">
            Join the hundreds of companies already leveraging Group66 for their vector database needs. 
            Contact us for a personalized demo or start with our free tier today.
          </p>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors">
          Contact Us
        </button>
      </div>
    </div>
  );
}
