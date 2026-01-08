import React, { useState, useEffect } from 'react';
import { Coffee, CheckCircle, LogOut, Play, Settings, User, Fingerprint, ExternalLink, Clock } from 'lucide-react';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbz2EKqIwUtc9aFRePxQoDj5UELzcIxJC_Z6CI_vlRpa3cnP26IvrLRaEjY29ExRUUj-/exec';

function App() {
    const [status, setStatus] = useState(() => localStorage.getItem('tracker_status') || 'idle');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const [userInfo, setUserInfo] = useState(() => {
        const saved = localStorage.getItem('user_info');
        return saved ? JSON.parse(saved) : { id: 'T001', name: '研修生' };
    });

    const [tempUserInfo, setTempUserInfo] = useState(userInfo);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        localStorage.setItem('tracker_status', status);
    }, [status]);

    const formatTime = (date) => {
        return date.toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
    };

    const handleAction = async (type, extraData = {}) => {
        if (!userInfo.id || !userInfo.name) {
            setShowSettings(true);
            return;
        }

        setLoading(true);
        try {
            await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    traineeId: userInfo.id,
                    name: userInfo.name,
                    appUrl: window.location.href,
                    ...extraData
                }),
            });

            if (type === 'clock-in') setStatus('working');
            if (type === 'clock-out') setStatus('idle');
            if (type === 'break-start') setStatus('break');
            if (type === 'break-end') setStatus('working');

            // Feedback: simple alert for now, can be improved to a toast
            if (type !== 'assignment') {
                // Success animation or something
            } else {
                alert('報告が完了しました');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('接続エラーが発生しました。インターネット接続を確認してください。');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = () => {
        setUserInfo(tempUserInfo);
        localStorage.setItem('user_info', JSON.stringify(tempUserInfo));
        setShowSettings(false);
    };

    const handleReport = () => {
        const url = prompt('提出するアプリや課題のURLを入力してください（任意）', '');
        handleAction('assignment', { appUrl: url || window.location.href });
    };

    return (
        <div className="container">
            <div className="glass-card">
                <div className="status-badge-container">
                    <div className={`status-badge status-${status}`}>
                        {status === 'idle' && <><Clock size={16} /> 未出勤</>}
                        {status === 'working' && <><Fingerprint size={16} /> 勤務中</>}
                        {status === 'break' && <><Coffee size={16} /> 休憩中</>}
                    </div>
                </div>

                <div className="time-display">{formatTime(currentTime)}</div>
                <div className="date-display">{formatDate(currentTime)}</div>

                <div className="main-action">
                    {status === 'idle' ? (
                        <button
                            className="punch-button"
                            onClick={() => handleAction('clock-in')}
                            disabled={loading}
                        >
                            {loading ? <div className="loader"></div> : <><Play size={48} fill="currentColor" /><span>出勤</span></>}
                        </button>
                    ) : (
                        <button
                            className="punch-button out"
                            onClick={() => handleAction('clock-out')}
                            disabled={loading}
                        >
                            {loading ? <div className="loader"></div> : <><LogOut size={48} /><span>退勤</span></>}
                        </button>
                    )}
                </div>

                <div className="secondary-grid">
                    <button
                        className="btn-secondary"
                        onClick={() => handleAction(status === 'break' ? 'break-end' : 'break-start')}
                        disabled={loading || status === 'idle'}
                    >
                        <Coffee size={20} />
                        {status === 'break' ? '休憩終了' : '休憩開始'}
                    </button>

                    <button
                        className="btn-secondary"
                        onClick={handleReport}
                        disabled={loading}
                    >
                        <CheckCircle size={20} />
                        課題報告
                    </button>

                    <button
                        className="btn-secondary btn-report"
                        onClick={() => handleAction('assignment')}
                        disabled={loading}
                    >
                        <ExternalLink size={20} />
                        管理者へ報告
                    </button>
                </div>

                <div className="user-info">
                    <User size={14} />
                    <span>{userInfo.name} ({userInfo.id})</span>
                    <button className="settings-trigger" onClick={() => setShowSettings(true)}>
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>ユーザー設定</h2>
                        <div className="input-group">
                            <label>研修生ID</label>
                            <input
                                type="text"
                                value={tempUserInfo.id}
                                onChange={(e) => setTempUserInfo({ ...tempUserInfo, id: e.target.value })}
                                placeholder="例: T001"
                            />
                        </div>
                        <div className="input-group">
                            <label>氏名</label>
                            <input
                                type="text"
                                value={tempUserInfo.name}
                                onChange={(e) => setTempUserInfo({ ...tempUserInfo, name: e.target.value })}
                                placeholder="例: 山田 太郎"
                            />
                        </div>
                        <button className="btn-primary" onClick={saveSettings}>保存する</button>
                        <button
                            className="btn-secondary"
                            style={{ marginTop: '0.5rem', width: '100%' }}
                            onClick={() => setShowSettings(false)}
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
