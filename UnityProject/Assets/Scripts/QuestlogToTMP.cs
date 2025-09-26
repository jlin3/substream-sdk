using UnityEngine;
using TMPro;

public class QuestlogToTMP : MonoBehaviour
{
    public TMP_Text tmp_text;

    private void OnEnable()
    {
        Application.logMessageReceived += HandleLog;
    }

    private void OnDisable()
    {
        Application.logMessageReceived -= HandleLog;
    }

    private void HandleLog(string logString, string stackTrace, LogType type)
    {
        // Append errors only (or everything if you want)
        if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert)
        {
            if (tmp_text != null)
            {
                tmp_text.text += $"[{type}] {logString}\n{stackTrace}\n";
            }
        }
    }
}