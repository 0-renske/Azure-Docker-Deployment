
export default function VerifyEmail() {
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (timer > 0 && !canResend) {
      const interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0 && !canResend) {
      setCanResend(true);
    }
  }, [timer, canResend]);

  const handleVerification = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
    }, 2000);
  };

  const handleResendCode = () => {
    setCanResend(false);
    setTimer(60);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify Your Email</h2>
          <p className="text-gray-600 mb-6">
            Please enter the verification code that was sent to your email address
          </p>
        </div>

        <form onSubmit={handleVerification} className="space-y-6">
          <div className="flex justify-center">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="6"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="w-48 text-center text-2xl px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              placeholder="000000"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-500 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Verifying...' : 'Verify Email'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600 mb-2">Didn't receive a code?</p>
          <button
            onClick={handleResendCode}
            disabled={!canResend}
            className="text-sm font-medium text-sky-600 hover:text-sky-500 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {canResend ? 'Resend Code' : `Resend in ${timer} seconds`}
          </button>
        </div>

        <div className="text-xs text-center text-gray-500 mt-6">
          <p>
            If you're having trouble, please contact{' '}
            <a href="mailto:support@group66.com" className="text-sky-600 hover:text-sky-500">
              support@group66.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
