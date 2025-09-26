using UnityEngine;

public class RotateTwoAxis : MonoBehaviour
{
    public float speedX = 50f; 
    public float speedY = 30f; 

    void Update()
    {
        float rotX = speedX * Time.deltaTime;
        float rotY = speedY * Time.deltaTime;

        transform.Rotate(rotX, rotY, 0f);
    }
}
